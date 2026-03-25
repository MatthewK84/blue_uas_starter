import { useState, useMemo } from 'react';
import { DRONES, type Drone } from './data';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, AreaChart, Area, BarChart, Bar, Cell,
  ReferenceLine,
} from 'recharts';

/* ════════════════════════════════════════════
 * CONSTANTS & PHYSICS MODELS
 * ════════════════════════════════════════════ */

const ISA_TEMP = 15;
const ISA_DENSITY = 1.225;
const LAPSE_RATE = 0.0065; // °C per meter
const R_AIR = 287.058;
const G = 9.80665;

/** Environmental theater presets */
const THEATER_PRESETS: ReadonlyArray<{
  readonly id: string;
  readonly label: string;
  readonly desc: string;
  readonly tempC: number;
  readonly humidity: number;
  readonly windKts: number;
  readonly dustUgM3: number;
  readonly elevM: number;
}> = [
  { id: 'gulf', label: 'Persian Gulf', desc: 'Kuwait / Qatar / UAE', tempC: 50, humidity: 80, windKts: 25, dustUgM3: 3000, elevM: 0 },
  { id: 'levant', label: 'Levant', desc: 'Iraq / Jordan / Kurdistan', tempC: 48, humidity: 12, windKts: 35, dustUgM3: 6000, elevM: 800 },
  { id: 'redsea', label: 'Red Sea / HoA', desc: 'Djibouti / Yemen coast', tempC: 45, humidity: 65, windKts: 20, dustUgM3: 1500, elevM: 0 },
  { id: 'mild', label: 'Temperate', desc: 'CONUS baseline', tempC: 25, humidity: 40, windKts: 10, dustUgM3: 50, elevM: 200 },
] as const;

/* ── K1000ULE altitude / battery model ── */

interface AltitudePoint {
  altitude_ft: number;
  temp_c: number;
  air_density: number;
  battery_voltage: number;
  battery_capacity_pct: number;
  solar_irradiance: number;
  charge_rate_w: number;
  net_power_w: number;
  phase: string;
}

function altitudeTempC(groundTempC: number, altFt: number): number {
  const altM = altFt * 0.3048;
  return groundTempC - LAPSE_RATE * altM;
}

function airDensityAtAlt(groundTempC: number, altFt: number, elevM: number): number {
  const altM = altFt * 0.3048 + elevM;
  const tempK = (groundTempC + 273.15) - LAPSE_RATE * altM;
  const pressure = 101325 * Math.pow(1 - (LAPSE_RATE * altM) / 288.15, G / (LAPSE_RATE * R_AIR));
  return pressure / (R_AIR * tempK);
}

function solarIrradianceAtAlt(altFt: number, groundHumidity: number): number {
  // At higher altitude, less atmosphere to attenuate. Ground-level ~800-1000 W/m² in ME
  // Humidity reduces transmittance
  const baseIrradiance = 1000;
  const humidityFactor = 1 - (groundHumidity / 100) * 0.15;
  const altBoost = 1 + (altFt / 60000) * 0.25; // ~25% gain at 60k ft
  return Math.round(baseIrradiance * humidityFactor * altBoost);
}

function batteryVoltageAtTemp(tempC: number, socPct: number): number {
  // 6S Li-ion nominal 22.2V, temp coefficient ~-0.003V/°C below 25°C
  const nominal = 22.2;
  const socFactor = 0.85 + 0.15 * (socPct / 100);
  const tempDelta = tempC < 25 ? (25 - tempC) * 0.003 : -(tempC - 25) * 0.001;
  return Math.round((nominal * socFactor - tempDelta) * 100) / 100;
}

function batteryCapacityAtTemp(tempC: number): number {
  // Li-ion capacity degrades below 0°C and above 45°C
  if (tempC < -20) return 55;
  if (tempC < 0) return 55 + (tempC + 20) * (85 - 55) / 20;
  if (tempC < 10) return 85 + (tempC) * (95 - 85) / 10;
  if (tempC <= 25) return 95 + (tempC - 10) * 5 / 15;
  if (tempC <= 40) return 100 - (tempC - 25) * 3 / 15;
  return Math.max(100 - (tempC - 25) * 3 / 15 - (tempC - 40) * 8 / 15, 60);
}

function generateK1000Climb(groundTempC: number, groundHumidity: number): AltitudePoint[] {
  const points: AltitudePoint[] = [];
  const maxAlt = 20000;
  const step = 500;
  // Climb phase: 0 → 20,000 ft
  for (let alt = 0; alt <= maxAlt; alt += step) {
    const tempAtAlt = altitudeTempC(groundTempC, alt);
    const rho = airDensityAtAlt(groundTempC, alt, 0);
    const capPct = batteryCapacityAtTemp(tempAtAlt);
    const solar = solarIrradianceAtAlt(alt, groundHumidity);
    // K1000ULE solar array ~1.2 m², efficiency ~22%
    const solarPowerW = solar * 1.2 * 0.22;
    // Cruise power ~180W at sea level, increases with altitude (thinner air → more drag at same speed)
    const cruisePower = 180 * Math.pow(ISA_DENSITY / rho, 0.5);
    const netPower = solarPowerW - cruisePower;
    const soc = alt <= 5000 ? 90 - (alt / 5000) * 15
      : alt <= 10000 ? 75 - ((alt - 5000) / 5000) * 10
      : alt <= 15000 ? 65 - ((alt - 10000) / 5000) * 8
      : 57 - ((alt - 15000) / 5000) * 5;
    points.push({
      altitude_ft: alt,
      temp_c: Math.round(tempAtAlt * 10) / 10,
      air_density: Math.round(rho * 1000) / 1000,
      battery_voltage: batteryVoltageAtTemp(tempAtAlt, soc),
      battery_capacity_pct: Math.round(capPct),
      solar_irradiance: solar,
      charge_rate_w: Math.round(solarPowerW),
      net_power_w: Math.round(netPower),
      phase: alt < 15000 ? 'Climb' : 'Cruise / Recharge',
    });
  }
  return points;
}

interface RechargePoint {
  minute: number;
  soc_pct: number;
  voltage: number;
  charge_rate_w: number;
  cell_temp_c: number;
  phase: string;
}

function generateRechargeAtAlt(altFt: number, groundTempC: number, groundHumidity: number): RechargePoint[] {
  const points: RechargePoint[] = [];
  const ambientAtAlt = altitudeTempC(groundTempC, altFt);
  const solar = solarIrradianceAtAlt(altFt, groundHumidity);
  const solarPowerW = solar * 1.2 * 0.22;
  const cruisePower = 180 * Math.pow(ISA_DENSITY / airDensityAtAlt(groundTempC, altFt, 0), 0.5);
  const netChargeW = solarPowerW - cruisePower;
  // K1000ULE battery: 6S4P 21700 Molicel P42A, ~533 Wh
  const battCapacityWh = 533;

  let soc = 52; // Post-climb SOC at 20k ft
  for (let min = 0; min <= 360; min += 5) {
    const chargeWh = (netChargeW * 5) / 60;
    // Charge efficiency degrades with SOC (CC-CV transition)
    const chargeEff = soc < 80 ? 0.95 : 0.95 - (soc - 80) * 0.015;
    soc = Math.min(soc + (chargeWh * chargeEff / battCapacityWh) * 100, 100);
    const cellTemp = ambientAtAlt + 8 + (netChargeW > 0 ? netChargeW * 0.02 : 0);
    const phase = soc < 80 ? 'CC Charge' : soc < 95 ? 'CV Taper' : 'Float / Maintenance';
    points.push({
      minute: min,
      soc_pct: Math.round(soc * 10) / 10,
      voltage: batteryVoltageAtTemp(cellTemp, soc),
      charge_rate_w: Math.round(netChargeW * chargeEff),
      cell_temp_c: Math.round(cellTemp * 10) / 10,
      phase,
    });
  }
  return points;
}

/* ── Environmental stress models ── */

interface AirframeStress {
  drone: Drone;
  windScore: number;       // 0-100, higher = more resistant
  windEffect: string;
  shimmerScore: number;    // 0-100, higher = less affected
  shimmerEffect: string;
  humidityScore: number;   // 0-100, higher = more resistant
  humidityEffect: string;
  dustScore: number;       // 0-100
  dustEffect: string;
  overallRating: string;
}

function computeWindResistance(drone: Drone, windKts: number): { score: number; effect: string } {
  // Heavier = more wind resistant; fixed wing > multi-rotor in sustained wind
  const isFixedWing = drone.type.toLowerCase().includes('fixed wing') ||
    drone.type.toLowerCase().includes('vtol fixed') ||
    drone.type.toLowerCase().includes('ducted');
  const massFactor = Math.min(drone.weight_lbs / 55, 1) * 40;
  const typeFactor = isFixedWing ? 35 : drone.type.toLowerCase().includes('coaxial') ? 25 : 15;
  const speedFactor = Math.min(drone.max_speed_mph / 100, 1) * 25;
  const raw = massFactor + typeFactor + speedFactor;
  // Penalize for high wind
  const windPenalty = Math.max(0, (windKts - 15) * 1.5);
  const score = Math.max(0, Math.min(100, raw - windPenalty));
  const effect = score >= 70 ? 'Operational'
    : score >= 40 ? 'Degraded — reduced loiter'
    : 'Grounded — exceeds safe envelope';
  return { score: Math.round(score), effect };
}

function computeShimmerEffect(drone: Drone, tempC: number, humidity: number): { score: number; effect: string } {
  // Heat shimmer degrades EO/IR sensors, especially at low altitude
  // Fixed wing at altitude less affected; FPV and low-altitude rotors most affected
  const isFPV = drone.mission.toLowerCase().includes('fpv');
  const isHighAlt = drone.type.toLowerCase().includes('fixed wing') && drone.range_mi > 20;
  const shimmerIntensity = Math.max(0, (tempC - 30) * 2 + (100 - humidity) * 0.3);
  const basePenalty = shimmerIntensity * (isFPV ? 1.2 : isHighAlt ? 0.3 : 0.7);
  const score = Math.max(0, Math.min(100, 100 - basePenalty));
  const effect = score >= 75 ? 'Minimal — sensors nominal'
    : score >= 45 ? 'Moderate — EO degraded, IR usable'
    : 'Severe — target acq significantly impaired';
  return { score: Math.round(score), effect };
}

function computeHumidityEffect(drone: Drone, humidity: number, tempC: number): { score: number; effect: string } {
  // High humidity: condensation risk on electronics, corrosion, RF propagation degradation
  // Tethered systems with sealed enclosures fare better
  const isSealed = drone.desc.toLowerCase().includes('ip4') ||
    drone.desc.toLowerCase().includes('all-weather') ||
    drone.desc.toLowerCase().includes('rain');
  const basePenalty = Math.max(0, (humidity - 50) * 0.8);
  const heatIndex = humidity > 60 && tempC > 35 ? (humidity - 60) * (tempC - 35) * 0.05 : 0;
  const sealBonus = isSealed ? 20 : 0;
  const score = Math.max(0, Math.min(100, 100 - basePenalty - heatIndex + sealBonus));
  const effect = score >= 70 ? 'Nominal — within operating envelope'
    : score >= 40 ? 'Caution — condensation risk, check seals'
    : 'Warning — corrosion & electronics risk';
  return { score: Math.round(score), effect };
}

function computeDustEffect(drone: Drone, dustUgM3: number): { score: number; effect: string } {
  // Dust: bearing fouling, optical degradation, motor heating
  const hasExposedMotors = !drone.type.toLowerCase().includes('ducted');
  const basePenalty = (dustUgM3 / 10000) * 60;
  const motorPenalty = hasExposedMotors ? (dustUgM3 / 10000) * 20 : 0;
  const score = Math.max(0, Math.min(100, 100 - basePenalty - motorPenalty));
  const effect = score >= 70 ? 'Operational — standard maintenance'
    : score >= 40 ? 'Degraded — accelerated bearing wear'
    : 'Hazardous — Shamal/haboob, ground operations';
  return { score: Math.round(score), effect };
}

function computeAirframeStresses(
  drones: ReadonlyArray<Drone>,
  tempC: number,
  humidity: number,
  windKts: number,
  dustUgM3: number,
): AirframeStress[] {
  return drones.map(drone => {
    const wind = computeWindResistance(drone, windKts);
    const shimmer = computeShimmerEffect(drone, tempC, humidity);
    const hum = computeHumidityEffect(drone, humidity, tempC);
    const dust = computeDustEffect(drone, dustUgM3);
    const avg = (wind.score + shimmer.score + hum.score + dust.score) / 4;
    const overallRating = avg >= 70 ? 'GREEN' : avg >= 40 ? 'AMBER' : 'RED';
    return {
      drone,
      windScore: wind.score,
      windEffect: wind.effect,
      shimmerScore: shimmer.score,
      shimmerEffect: shimmer.effect,
      humidityScore: hum.score,
      humidityEffect: hum.effect,
      dustScore: dust.score,
      dustEffect: dust.effect,
      overallRating,
    };
  });
}

/* ── Temperature sweep model ── */

interface TempSweepPoint {
  temp_c: number;
  temp_f: number;
  endurance_pct: number;
  range_pct: number;
  hover_power_increase: number;
  battery_capacity_pct: number;
  air_density: number;
  density_alt_ft: number;
}

function generateTempSweep(elevM: number): TempSweepPoint[] {
  const points: TempSweepPoint[] = [];
  for (let t = -20; t <= 55; t += 1) {
    const tempK = t + 273.15;
    const altM = elevM;
    const pressure = 101325 * Math.pow(1 - (LAPSE_RATE * altM) / 288.15, G / (LAPSE_RATE * R_AIR));
    const rho = pressure / (R_AIR * tempK);

    // Endurance model: battery capacity + air density compound effect
    const batCap = batteryCapacityAtTemp(t);
    const densityPenalty = t > ISA_TEMP ? (1 - rho / ISA_DENSITY) * 100 * 1.5 : 0;
    const coldPenalty = t < 0 ? Math.abs(t) * 0.8 : 0;
    const endurancePct = Math.max(30, Math.min(100, batCap - densityPenalty - coldPenalty));

    // Range model: endurance × speed factor
    const speedLoss = t > 40 ? (t - 40) * 0.5 : t < -10 ? Math.abs(t + 10) * 0.3 : 0;
    const rangePct = Math.max(25, Math.min(100, endurancePct - speedLoss));

    // Hover power increase
    const hoverIncrease = t > ISA_TEMP
      ? ((1 - rho / ISA_DENSITY) * 0.54 * 100) + Math.max(0, t - 25) * 0.4
      : t < 0 ? Math.abs(t) * 0.2 : 0;

    // Density altitude
    const daStd = 288.15;
    const daFt = (1 - Math.pow(rho / ISA_DENSITY, 1 / 4.2559)) * (daStd / LAPSE_RATE) / 0.3048;

    points.push({
      temp_c: t,
      temp_f: Math.round(t * 9 / 5 + 32),
      endurance_pct: Math.round(endurancePct * 10) / 10,
      range_pct: Math.round(rangePct * 10) / 10,
      hover_power_increase: Math.round(hoverIncrease * 10) / 10,
      battery_capacity_pct: Math.round(batCap),
      air_density: Math.round(rho * 1000) / 1000,
      density_alt_ft: Math.round(daFt),
    });
  }
  return points;
}

interface PerPlatformTemp {
  temp_c: number;
  platforms: Array<{
    id: number;
    model: string;
    endurance_min: number;
    range_mi: number;
    status: string;
  }>;
}

function generatePlatformTempSweep(drones: ReadonlyArray<Drone>): PerPlatformTemp[] {
  const results: PerPlatformTemp[] = [];
  for (let t = -20; t <= 55; t += 5) {
    const batCapFactor = batteryCapacityAtTemp(t) / 100;
    const coldFactor = t < 0 ? 1 - Math.abs(t) * 0.008 : 1;
    const hotFactor = t > 40 ? 1 - (t - 40) * 0.015 : 1;
    const totalFactor = Math.max(0.3, batCapFactor * coldFactor * hotFactor);

    const platforms = drones.filter(d => !d.tethered).map(d => {
      const endMin = Math.round(d.flight_time_min * totalFactor);
      const rangeMi = Math.round(d.range_mi * totalFactor * 10) / 10;
      const exceedsMax = t > d.operating_temp_max_c;
      const belowMin = t < -10; // Most LiPo/Li-ion degrade significantly below -10
      const status = exceedsMax ? 'OVER-TEMP' : belowMin ? 'COLD-LIMIT' : 'OPERATIONAL';
      return { id: d.id, model: d.model, endurance_min: endMin, range_mi: rangeMi, status };
    });
    results.push({ temp_c: t, platforms });
  }
  return results;
}

/* ── Tooltip Components ── */

interface TooltipPayloadEntry {
  value: number;
  name: string;
  color: string;
}

function AltTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="tt-model">{label?.toLocaleString()} ft</div>
      {payload.map((p, i) => (
        <div key={i} className="tt-row">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="tt-val">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

function SweepTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="tt-model">{label}°C / {label !== undefined ? Math.round(label * 9 / 5 + 32) : 0}°F</div>
      {payload.map((p, i) => (
        <div key={i} className="tt-row">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="tt-val">
            {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
            {p.name.includes('%') || p.name.includes('pct') || p.name.includes('Endurance') || p.name.includes('Range') || p.name.includes('Battery') ? '%' : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Score bar component ── */

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? '#2dd4a0' : score >= 40 ? '#f0a030' : '#f0506e';
  return (
    <div className="te-score-bar-wrap">
      <div className="te-score-label">{label}</div>
      <div className="te-score-track">
        <div className="te-score-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <div className="te-score-val" style={{ color }}>{score}</div>
    </div>
  );
}

/* ════════════════════════════════════════════
 * MAIN COMPONENT
 * ════════════════════════════════════════════ */

export default function TheaterEffectsTab() {
  const [activeSection, setActiveSection] = useState<'k1000' | 'stressors' | 'tempsweep'>('k1000');
  const [theaterIdx, setTheaterIdx] = useState(0);
  const [sweepElevM, setSweepElevM] = useState(0);
  const [expandedDroneId, setExpandedDroneId] = useState<number | null>(null);
  const [stressSortBy, setStressSortBy] = useState<'overall' | 'wind' | 'shimmer' | 'humidity' | 'dust'>('overall');

  const theater = THEATER_PRESETS[theaterIdx];

  /* K1000ULE data */
  const k1000Climb = useMemo(() => generateK1000Climb(theater.tempC, theater.humidity), [theater.tempC, theater.humidity]);
  const k1000Recharge = useMemo(() => generateRechargeAtAlt(20000, theater.tempC, theater.humidity), [theater.tempC, theater.humidity]);

  /* Environmental stress data */
  const nonTethered = useMemo(() => DRONES.filter(d => !d.tethered), []);
  const airframeStresses = useMemo(
    () => computeAirframeStresses(nonTethered, theater.tempC, theater.humidity, theater.windKts, theater.dustUgM3),
    [nonTethered, theater.tempC, theater.humidity, theater.windKts, theater.dustUgM3],
  );

  const sortedStresses = useMemo(() => {
    const copy = [...airframeStresses];
    const keyMap: Record<string, keyof AirframeStress> = {
      overall: 'windScore', wind: 'windScore', shimmer: 'shimmerScore',
      humidity: 'humidityScore', dust: 'dustScore',
    };
    const key = keyMap[stressSortBy];
    if (stressSortBy === 'overall') {
      copy.sort((a, b) => {
        const aAvg = (a.windScore + a.shimmerScore + a.humidityScore + a.dustScore) / 4;
        const bAvg = (b.windScore + b.shimmerScore + b.humidityScore + b.dustScore) / 4;
        return bAvg - aAvg;
      });
    } else {
      copy.sort((a, b) => (b[key] as number) - (a[key] as number));
    }
    return copy;
  }, [airframeStresses, stressSortBy]);

  /* Temperature sweep data */
  const tempSweep = useMemo(() => generateTempSweep(sweepElevM), [sweepElevM]);
  const platformSweep = useMemo(() => generatePlatformTempSweep(nonTethered), [nonTethered]);

  /* Stressor summary counts */
  const stressCounts = useMemo(() => {
    const green = airframeStresses.filter(s => s.overallRating === 'GREEN').length;
    const amber = airframeStresses.filter(s => s.overallRating === 'AMBER').length;
    const red = airframeStresses.filter(s => s.overallRating === 'RED').length;
    return { green, amber, red };
  }, [airframeStresses]);

  const elevLabel = sweepElevM === 0 ? 'Sea Level' : sweepElevM === 800 ? '800m (Amman)' : '1,500m (Kurdistan)';

  return (
    <div className="te-tab">
      <h2>Theater Environmental Effects</h2>
      <p className="section-desc">
        Altitude-dependent battery behavior for the K1000ULE solar platform, environmental
        stressor impact on all airframes, and full temperature sweep simulation from −20°C to 55°C.
      </p>

      {/* ── Theater Preset Selector ── */}
      <div className="te-theater-bar">
        {THEATER_PRESETS.map((t, i) => (
          <button
            key={t.id}
            className={`te-theater-btn ${theaterIdx === i ? 'active' : ''} ${t.tempC >= 48 ? 'hot' : t.tempC >= 40 ? 'warm' : ''}`}
            onClick={() => setTheaterIdx(i)}
          >
            <span className="te-theater-name">{t.label}</span>
            <span className="te-theater-desc">{t.desc}</span>
            <span className="te-theater-temp">{t.tempC}°C · {t.humidity}% RH · {t.windKts} kts</span>
          </button>
        ))}
      </div>

      {/* ── Sub-tabs ── */}
      <div className="tabs" style={{ maxWidth: 600, marginBottom: 16 }}>
        {([
          ['k1000', 'K1000ULE Altitude'],
          ['stressors', 'Environmental Stressors'],
          ['tempsweep', 'Temperature Sweep'],
        ] as const).map(([key, label]) => (
          <button key={key}
            className={`tab-btn ${activeSection === key ? 'active' : ''}`}
            onClick={() => setActiveSection(key)}>
            {label}
          </button>
        ))}
      </div>

      {/* ═══════ K1000ULE SECTION ═══════ */}
      {activeSection === 'k1000' && (
        <div className="te-section-content">
          {/* Readout cards */}
          <div className="env-readouts" style={{ marginBottom: 20 }}>
            {[
              { l: 'Service Ceiling', v: '20,000 ft', sub: 'K1000ULE max altitude', warn: false },
              { l: 'Ground Temp', v: `${theater.tempC}°C`, sub: theater.label, warn: theater.tempC >= 45 },
              { l: 'Temp at 20k ft', v: `${altitudeTempC(theater.tempC, 20000).toFixed(1)}°C`, sub: `−${(theater.tempC - altitudeTempC(theater.tempC, 20000)).toFixed(0)}°C lapse`, warn: altitudeTempC(theater.tempC, 20000) < -10 },
              { l: 'Solar at 20k ft', v: `${solarIrradianceAtAlt(20000, theater.humidity)} W/m²`, sub: `${theater.humidity}% RH ground`, warn: false },
            ].map((r, i) => (
              <div key={i} className={`env-readout ${r.warn ? 'warn' : ''}`}>
                <div className="spec-label">{r.l}</div>
                <div className="env-readout-value">{r.v}</div>
                <div className="env-readout-sub">{r.sub}</div>
              </div>
            ))}
          </div>

          {/* Climb Profile Chart */}
          <div className="chart-card">
            <h3>K1000ULE Climb Profile — Battery & Atmosphere</h3>
            <p className="chart-subtitle">
              Ground launch at {theater.tempC}°C → 20,000 ft ceiling. Temperature, density, and solar irradiance vs altitude.
            </p>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={k1000Climb} margin={{ left: 10, right: 20, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a38" />
                <XAxis dataKey="altitude_ft" tick={{ fontSize: 11, fill: '#556272' }}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                  label={{ value: 'Altitude (ft)', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#556272' }} />
                <YAxis yAxisId="temp" domain={[-30, 60]} tick={{ fontSize: 11, fill: '#556272' }}
                  label={{ value: '°C', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#556272' }} />
                <YAxis yAxisId="pwr" orientation="right" domain={[0, 350]} tick={{ fontSize: 11, fill: '#556272' }}
                  label={{ value: 'Watts', angle: 90, position: 'insideRight', fontSize: 11, fill: '#556272' }} />
                <Tooltip content={<AltTooltip />} />
                <ReferenceLine yAxisId="temp" y={0} stroke="#556272" strokeDasharray="3 3" />
                <Line yAxisId="temp" type="monotone" dataKey="temp_c" name="Temperature (°C)" stroke="#4ea4f6" strokeWidth={2.5} dot={false} />
                <Line yAxisId="pwr" type="monotone" dataKey="charge_rate_w" name="Solar Input (W)" stroke="#f0a030" strokeWidth={2} dot={false} />
                <Line yAxisId="pwr" type="monotone" dataKey="net_power_w" name="Net Power (W)" stroke="#2dd4a0" strokeWidth={2} dot={false} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
            <div className="legend-row">
              <div className="legend-item"><div className="legend-dot" style={{ background: '#4ea4f6' }} />Temperature</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#f0a030' }} />Solar Input</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#2dd4a0' }} />Net Power</div>
            </div>
          </div>

          {/* Battery voltage & capacity at altitude */}
          <div className="chart-card" style={{ marginTop: 16 }}>
            <h3>Battery State During Climb</h3>
            <p className="chart-subtitle">Voltage and available capacity degrade as cell temperature drops with altitude</p>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={k1000Climb} margin={{ left: 10, right: 20, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a38" />
                <XAxis dataKey="altitude_ft" tick={{ fontSize: 11, fill: '#556272' }}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                  label={{ value: 'Altitude (ft)', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#556272' }} />
                <YAxis domain={[50, 105]} tick={{ fontSize: 11, fill: '#556272' }}
                  label={{ value: '% Capacity', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#556272' }} />
                <Tooltip content={<AltTooltip />} />
                <Area type="monotone" dataKey="battery_capacity_pct" name="Battery Capacity %" fill="#6366f1" fillOpacity={0.2} stroke="#6366f1" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Recharge at 20k ft chart */}
          <div className="chart-card" style={{ marginTop: 16 }}>
            <h3>Recharge Cycle at 20,000 ft</h3>
            <p className="chart-subtitle">
              Solar recharge while cruising at ceiling. Ambient at altitude: {altitudeTempC(theater.tempC, 20000).toFixed(1)}°C.
              Net charge = solar input − cruise draw.
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={k1000Recharge} margin={{ left: 10, right: 20, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a38" />
                <XAxis dataKey="minute" tick={{ fontSize: 11, fill: '#556272' }}
                  label={{ value: 'Minutes at Altitude', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#556272' }} />
                <YAxis yAxisId="soc" domain={[40, 105]} tick={{ fontSize: 11, fill: '#556272' }}
                  label={{ value: 'SOC %', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#556272' }} />
                <YAxis yAxisId="temp" orientation="right" domain={[-30, 30]} tick={{ fontSize: 11, fill: '#556272' }}
                  label={{ value: 'Cell °C', angle: 90, position: 'insideRight', fontSize: 11, fill: '#556272' }} />
                <Tooltip content={<SweepTooltip />} />
                <ReferenceLine yAxisId="soc" y={80} stroke="#f0a030" strokeDasharray="4 4" label={{ value: 'CC→CV', position: 'right', fontSize: 10, fill: '#f0a030' }} />
                <ReferenceLine yAxisId="soc" y={95} stroke="#2dd4a0" strokeDasharray="4 4" label={{ value: 'Float', position: 'right', fontSize: 10, fill: '#2dd4a0' }} />
                <Line yAxisId="soc" type="monotone" dataKey="soc_pct" name="SOC %" stroke="#6366f1" strokeWidth={2.5} dot={false} />
                <Line yAxisId="temp" type="monotone" dataKey="cell_temp_c" name="Cell Temp (°C)" stroke="#f0506e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="legend-row">
              <div className="legend-item"><div className="legend-dot" style={{ background: '#6366f1' }} />State of Charge</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#f0506e' }} />Cell Temperature</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#f0a030' }} />CC→CV transition</div>
            </div>
          </div>

          {/* K1000ULE mission summary */}
          <div className="te-mission-summary">
            <h3>K1000ULE Mission Profile — {theater.label}</h3>
            <div className="te-mission-grid">
              {[
                { phase: 'Ground Prep', time: '10 min', note: 'Box-to-flight. Battery pre-condition if >50°C' },
                { phase: 'Climb to 20k ft', time: '~35 min', note: `SOC drops ~38%. Cell temp falls to ${altitudeTempC(theater.tempC, 10000).toFixed(0)}°C at 10k ft` },
                { phase: 'Level / Recharge', time: '~4–6 hrs', note: `Solar net gain: ${k1000Recharge.length > 0 ? k1000Recharge[k1000Recharge.length - 1].charge_rate_w : 0}W. CC→CV at 80% SOC` },
                { phase: 'Night Ops', time: '8–10 hrs', note: 'Battery-only. Descent to lower altitude for warmer cells' },
                { phase: 'Total Endurance', time: '24+ hrs', note: `Demonstrated 26-hr non-stop. Record: 75 hr 53 min` },
              ].map((p, i) => (
                <div key={i} className="te-phase-card">
                  <div className="te-phase-num">{i + 1}</div>
                  <div className="te-phase-info">
                    <div className="te-phase-name">{p.phase}</div>
                    <div className="te-phase-time">{p.time}</div>
                    <div className="te-phase-note">{p.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ ENVIRONMENTAL STRESSORS ═══════ */}
      {activeSection === 'stressors' && (
        <div className="te-section-content">
          {/* Theater condition readouts */}
          <div className="env-readouts" style={{ marginBottom: 16 }}>
            {[
              { l: 'Wind', v: `${theater.windKts} kts`, sub: theater.windKts >= 30 ? 'Shamal-class' : 'Moderate', warn: theater.windKts >= 30 },
              { l: 'Dust Load', v: `${theater.dustUgM3.toLocaleString()} µg/m³`, sub: theater.dustUgM3 > 3000 ? 'Heavy / Haboob risk' : 'Normal', warn: theater.dustUgM3 > 3000 },
              { l: 'Humidity', v: `${theater.humidity}%`, sub: theater.humidity > 70 ? 'Coastal / condensation' : 'Dry inland', warn: theater.humidity > 70 },
              { l: 'Heat Shimmer', v: theater.tempC > 40 ? 'Severe' : theater.tempC > 30 ? 'Moderate' : 'Low', sub: `${theater.tempC}°C surface`, warn: theater.tempC > 40 },
            ].map((r, i) => (
              <div key={i} className={`env-readout ${r.warn ? 'warn' : ''}`}>
                <div className="spec-label">{r.l}</div>
                <div className="env-readout-value">{r.v}</div>
                <div className="env-readout-sub">{r.sub}</div>
              </div>
            ))}
          </div>

          {/* Status summary */}
          <div className="te-status-summary">
            <div className="te-status-count green">{stressCounts.green} <span>GREEN</span></div>
            <div className="te-status-count amber">{stressCounts.amber} <span>AMBER</span></div>
            <div className="te-status-count red">{stressCounts.red} <span>RED</span></div>
          </div>

          {/* Sort control */}
          <div className="te-sort-bar">
            <span className="te-sort-label">Sort by:</span>
            {(['overall', 'wind', 'shimmer', 'humidity', 'dust'] as const).map(key => (
              <button key={key}
                className={`te-sort-btn ${stressSortBy === key ? 'active' : ''}`}
                onClick={() => setStressSortBy(key)}>
                {key === 'overall' ? 'Overall' : key === 'shimmer' ? 'Heat Shimmer' : key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>

          {/* Airframe stress cards */}
          <div className="te-stress-list">
            {sortedStresses.map((s, i) => {
              const avg = Math.round((s.windScore + s.shimmerScore + s.humidityScore + s.dustScore) / 4);
              const isExpanded = expandedDroneId === s.drone.id;
              return (
                <div key={s.drone.id} className={`te-stress-card ${s.overallRating.toLowerCase()}`}
                  style={{ animationDelay: `${i * 0.02}s` }}
                  onClick={() => setExpandedDroneId(isExpanded ? null : s.drone.id)}>
                  <div className="te-stress-top">
                    <div className={`te-rating-badge ${s.overallRating.toLowerCase()}`}>{s.overallRating}</div>
                    <div className="te-stress-identity">
                      <span className="model-name">{s.drone.model}</span>
                      <span className="mfr-name">{s.drone.manufacturer} · {s.drone.type}</span>
                    </div>
                    <div className="te-avg-score" style={{
                      color: avg >= 70 ? '#2dd4a0' : avg >= 40 ? '#f0a030' : '#f0506e'
                    }}>{avg}</div>
                    <span className={`chevron ${isExpanded ? 'open' : ''}`}>▾</span>
                  </div>
                  {isExpanded && (
                    <div className="te-stress-detail">
                      <ScoreBar score={s.windScore} label={`Wind (${theater.windKts} kts): ${s.windEffect}`} />
                      <ScoreBar score={s.shimmerScore} label={`Heat Shimmer: ${s.shimmerEffect}`} />
                      <ScoreBar score={s.humidityScore} label={`Humidity (${theater.humidity}%): ${s.humidityEffect}`} />
                      <ScoreBar score={s.dustScore} label={`Dust (${theater.dustUgM3.toLocaleString()} µg/m³): ${s.dustEffect}`} />
                      <div className="te-stress-specs">
                        <span>Weight: {s.drone.weight_lbs} lbs</span>
                        <span>Max Speed: {s.drone.max_speed_mph} mph</span>
                        <span>Max Temp: {s.drone.operating_temp_max_c}°C</span>
                        <span>Hot Endurance: {s.drone.hot_endurance_min} min</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════ TEMPERATURE SWEEP ═══════ */}
      {activeSection === 'tempsweep' && (
        <div className="te-section-content">
          {/* Elevation toggle */}
          <div className="te-sweep-controls">
            <div className="control-group">
              <div className="constraint-header">
                <span className="constraint-label">Elevation</span>
                <span className="constraint-value">{elevLabel}</span>
              </div>
              <div className="group-toggles">
                {([0, 800, 1500] as const).map(e => (
                  <button key={e} className={`group-toggle-btn ${sweepElevM === e ? 'g2 active' : ''}`}
                    onClick={() => setSweepElevM(e)}>{e === 0 ? 'Sea Lvl' : `${e}m`}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Endurance & range sweep chart */}
          <div className="chart-card">
            <h3>Performance Envelope: −20°C to 55°C (at {elevLabel})</h3>
            <p className="chart-subtitle">Estimated endurance and range retention as percentage of standard-day values</p>
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={tempSweep} margin={{ left: 10, right: 20, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a38" />
                <XAxis dataKey="temp_c" tick={{ fontSize: 11, fill: '#556272' }}
                  label={{ value: 'Temperature (°C)', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#556272' }} />
                <YAxis domain={[20, 105]} tick={{ fontSize: 11, fill: '#556272' }}
                  label={{ value: '% of Standard Day', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#556272' }} />
                <Tooltip content={<SweepTooltip />} />
                <ReferenceLine x={ISA_TEMP} stroke="#556272" strokeDasharray="4 4" label={{ value: 'ISA 15°C', position: 'top', fontSize: 10, fill: '#556272' }} />
                <ReferenceLine y={70} stroke="#f0506e" strokeDasharray="3 3" label={{ value: '70% floor', position: 'right', fontSize: 10, fill: '#f0506e' }} />
                <Area type="monotone" dataKey="endurance_pct" name="Endurance %" fill="#4ea4f6" fillOpacity={0.15} stroke="#4ea4f6" strokeWidth={2.5} />
                <Area type="monotone" dataKey="range_pct" name="Range %" fill="#2dd4a0" fillOpacity={0.1} stroke="#2dd4a0" strokeWidth={2} />
                <Area type="monotone" dataKey="battery_capacity_pct" name="Battery Cap %" fill="#6366f1" fillOpacity={0.08} stroke="#6366f1" strokeWidth={1.5} strokeDasharray="5 3" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="legend-row">
              <div className="legend-item"><div className="legend-dot" style={{ background: '#4ea4f6' }} />Endurance</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#2dd4a0' }} />Range</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#6366f1' }} />Battery Capacity</div>
            </div>
          </div>

          {/* Hover power & density altitude */}
          <div className="chart-card" style={{ marginTop: 16 }}>
            <h3>Hover Power Increase & Density Altitude</h3>
            <p className="chart-subtitle">Additional power required for hover + effective density altitude across temperature range</p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={tempSweep} margin={{ left: 10, right: 20, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a38" />
                <XAxis dataKey="temp_c" tick={{ fontSize: 11, fill: '#556272' }}
                  label={{ value: 'Temperature (°C)', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#556272' }} />
                <YAxis yAxisId="pwr" tick={{ fontSize: 11, fill: '#556272' }}
                  label={{ value: '% Power Increase', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#556272' }} />
                <YAxis yAxisId="da" orientation="right" tick={{ fontSize: 11, fill: '#556272' }}
                  label={{ value: 'Density Alt (ft)', angle: 90, position: 'insideRight', fontSize: 11, fill: '#556272' }} />
                <Tooltip content={<SweepTooltip />} />
                <ReferenceLine yAxisId="pwr" x={ISA_TEMP} stroke="#556272" strokeDasharray="4 4" />
                <Line yAxisId="pwr" type="monotone" dataKey="hover_power_increase" name="Hover Power ↑%" stroke="#f0506e" strokeWidth={2.5} dot={false} />
                <Line yAxisId="da" type="monotone" dataKey="density_alt_ft" name="Density Alt (ft)" stroke="#f0a030" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="legend-row">
              <div className="legend-item"><div className="legend-dot" style={{ background: '#f0506e' }} />Hover Power Increase</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#f0a030' }} />Density Altitude</div>
            </div>
          </div>

          {/* Per-platform heatmap table */}
          <div className="chart-card" style={{ marginTop: 16 }}>
            <h3>Per-Platform Temperature Heatmap</h3>
            <p className="chart-subtitle">Estimated endurance (minutes) at each temperature point. Red = over temp rating; blue = cold limit.</p>
            <div className="te-heatmap-scroll">
              <table className="te-heatmap-table">
                <thead>
                  <tr>
                    <th className="te-hm-th-platform">Platform</th>
                    {platformSweep.map(ps => (
                      <th key={ps.temp_c} className="te-hm-th-temp">{ps.temp_c}°</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nonTethered.slice(0, 30).map(drone => (
                    <tr key={drone.id} className="te-hm-row">
                      <td className="te-hm-platform">
                        <span className="te-hm-model">{drone.model}</span>
                        <span className="te-hm-mfr">{drone.manufacturer}</span>
                      </td>
                      {platformSweep.map(ps => {
                        const entry = ps.platforms.find(p => p.id === drone.id);
                        if (!entry) return <td key={ps.temp_c} className="te-hm-cell">—</td>;
                        const pct = entry.endurance_min / drone.flight_time_min;
                        const bg = entry.status === 'OVER-TEMP' ? 'rgba(240,80,110,0.35)'
                          : entry.status === 'COLD-LIMIT' ? 'rgba(78,164,246,0.3)'
                          : pct >= 0.85 ? 'rgba(45,212,160,0.2)'
                          : pct >= 0.65 ? 'rgba(240,160,48,0.2)'
                          : 'rgba(240,80,110,0.2)';
                        return (
                          <td key={ps.temp_c} className="te-hm-cell" style={{ background: bg }}>
                            {entry.endurance_min}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Air density chart */}
          <div className="chart-card" style={{ marginTop: 16 }}>
            <h3>Air Density vs Temperature</h3>
            <p className="chart-subtitle">At {elevLabel}. ISA standard: 1.225 kg/m³ at 15°C sea level.</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={tempSweep.filter((_, i) => i % 5 === 0)} margin={{ left: 10, right: 20, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a38" />
                <XAxis dataKey="temp_c" tick={{ fontSize: 11, fill: '#556272' }}
                  label={{ value: '°C', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#556272' }} />
                <YAxis domain={[0.85, 1.4]} tick={{ fontSize: 11, fill: '#556272' }}
                  label={{ value: 'kg/m³', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#556272' }} />
                <ReferenceLine y={ISA_DENSITY} stroke="#556272" strokeDasharray="4 4" label={{ value: 'ISA', position: 'right', fontSize: 10, fill: '#556272' }} />
                <Bar dataKey="air_density" name="Air Density" radius={[3, 3, 0, 0]}>
                  {tempSweep.filter((_, i) => i % 5 === 0).map((d, i) => (
                    <Cell key={i} fill={d.air_density >= ISA_DENSITY ? '#4ea4f6' : d.air_density >= 1.05 ? '#f0a030' : '#f0506e'} fillOpacity={0.7} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
