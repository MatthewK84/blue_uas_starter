import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, Cell, ReferenceLine, Area, AreaChart,
} from 'recharts';

/* ────────────────────────────────────────────
 * PHYSICS MODELS — sourced from sUAS White Paper
 * "Engineering sUAS Platforms for the Middle East"
 * ──────────────────────────────────────────── */

const ISA_TEMP = 15;    // °C
const ISA_DENSITY = 1.225; // kg/m³ at sea level
const P_SEA = 101325;  // Pa
const R_AIR = 287.05;  // J/(kg·K)
const CU_ALPHA = 0.00393; // Cu temp coeff per °C (NIST)

function airDensity(tempC: number, elevM: number): number {
  const tempK = tempC + 273.15;
  const lapseRate = 0.0065;
  const pressureAtElev = P_SEA * Math.pow(1 - (lapseRate * elevM) / 288.15, 5.2561);
  return pressureAtElev / (R_AIR * tempK);
}

function densityAltitudeFt(tempC: number, elevM: number): number {
  const rho = airDensity(tempC, elevM);
  const stdTempAtElev = 288.15 - 0.0065 * elevM;
  const isaRho = (P_SEA * Math.pow(1 - (0.0065 * elevM) / 288.15, 5.2561)) / (R_AIR * stdTempAtElev);
  const ratio = rho / isaRho;
  const daMeters = elevM + (1 - ratio) * 30000;
  return Math.round(daMeters * 3.281);
}

/**
 * Tarmac / ground surface heat soak model.
 *
 * Based on field measurement data:
 *
 * ASPHALT (dark, albedo 0.05–0.15):
 *   Absorbs 85–95% of solar energy. Surfaces often reach 60–80°C when ambient
 *   exceeds 35°C. Recorded 74°C at 49°C ambient (166°F at 120°F). Typically
 *   20–30°C above air temperature in full sun after hours of heat soak.
 *
 * CONCRETE (light gray, albedo 0.25–0.40):
 *   Reflects 20–40% of solar energy. Surfaces typically reach 50–65°C when
 *   ambient exceeds 35°C. Recorded 62°C in similar extreme conditions.
 *   Typically 15–25°C above air temperature in full sun.
 *
 * Difference: asphalt runs 10–25°C hotter than adjacent concrete under
 * identical conditions (field measurement: 63°C asphalt vs 51°C concrete curb).
 *
 * Below 35°C ambient, solar loading is lower and deltas are smaller.
 */

interface HeatSoakEntry {
  ambient: number;
  asphaltDelta: number;
  concreteDelta: number;
}

const HEAT_SOAK_TABLE: HeatSoakEntry[] = [
  { ambient: 0,  asphaltDelta: 3,  concreteDelta: 2 },
  { ambient: 15, asphaltDelta: 8,  concreteDelta: 5 },
  { ambient: 20, asphaltDelta: 12, concreteDelta: 8 },
  { ambient: 30, asphaltDelta: 18, concreteDelta: 12 },
  { ambient: 40, asphaltDelta: 23, concreteDelta: 17 },
  { ambient: 45, asphaltDelta: 26, concreteDelta: 19 },
  { ambient: 50, asphaltDelta: 28, concreteDelta: 20 },
];

function interpolateHeatSoak(tempC: number, surface: 'asphalt' | 'concrete'): number {
  const key = surface === 'asphalt' ? 'asphaltDelta' : 'concreteDelta';
  const table = HEAT_SOAK_TABLE;

  if (tempC <= table[0].ambient) return table[0][key];
  if (tempC >= table[table.length - 1].ambient) return table[table.length - 1][key];

  for (let i = 0; i < table.length - 1; i += 1) {
    const lo = table[i];
    const hi = table[i + 1];
    if (tempC >= lo.ambient && tempC <= hi.ambient) {
      const ratio = (tempC - lo.ambient) / (hi.ambient - lo.ambient);
      return Math.round(lo[key] + ratio * (hi[key] - lo[key]));
    }
  }
  return table[table.length - 1][key];
}

function tarmacTemp(ambientC: number, surfaceType: 'asphalt' | 'concrete'): number {
  return ambientC + interpolateHeatSoak(ambientC, surfaceType);
}

function cuResistanceIncrease(windingTempC: number): number {
  return CU_ALPHA * (windingTempC - 25) * 100;
}

function motorWindingTemp(ambientC: number): number {
  return ambientC + 70;
}

function ndfebFluxLoss(windingTempC: number): number {
  return Math.min(((windingTempC - 25) / (120 - 25)) * 11, 15);
}

function mosfetRdsIncrease(windingTempC: number): number {
  return Math.min(((windingTempC - 25) / (120 - 25)) * 85, 120);
}

function thrustReductionPct(ambientC: number, elevM: number): number {
  const rho = airDensity(ambientC, elevM);
  return (1 - rho / ISA_DENSITY) * 100;
}

function rpmIncreaseNeeded(ambientC: number, elevM: number): number {
  const rho = airDensity(ambientC, elevM);
  return (Math.sqrt(ISA_DENSITY / rho) - 1) * 100;
}

function powerIncreaseForThrust(ambientC: number, elevM: number): number {
  const rho = airDensity(ambientC, elevM);
  return (Math.pow(ISA_DENSITY / rho, 1.5) - 1) * 100;
}

function hoverPowerEscalation(ambientC: number, elevM: number): {
  aero: number; motor: number; esc_batt: number; total: number;
} {
  const rho = airDensity(ambientC, elevM);
  const densityLoss = 1 - rho / ISA_DENSITY;
  const aero = densityLoss * 0.54 * 100;
  const wTemp = motorWindingTemp(ambientC);
  const motor = Math.min(cuResistanceIncrease(wTemp) * 0.28, 18);
  const esc_batt = Math.min(densityLoss * 100 * 0.6 + (ambientC - ISA_TEMP) * 0.15, 16);
  const total = aero + motor + esc_batt;
  return { aero: Math.round(aero * 10) / 10, motor: Math.round(motor * 10) / 10, esc_batt: Math.round(esc_batt * 10) / 10, total: Math.round(total * 10) / 10 };
}

function batteryStatus(tempC: number): { label: string; color: string; desc: string } {
  if (tempC < 30) return { label: 'GO', color: '#2dd4a0', desc: 'Proceed to launch' };
  if (tempC < 50) return { label: 'COOL DOWN', color: '#f0a030', desc: 'DC cooler + shade. Target 25°C' };
  if (tempC < 55) return { label: 'DERATE', color: '#f0506e', desc: '25% endurance penalty. Cool before charging' };
  return { label: 'NO-GO', color: '#ff6b6b', desc: 'Do not fly. Immediate cooling required' };
}

function cycleLife(tempC: number): { lipo: number; liion: number; lifepo4: number } {
  const factor = tempC < 35 ? 1 : tempC < 45 ? 0.7 : tempC < 55 ? 0.4 : 0.2;
  return {
    lipo: Math.round(400 * factor),
    liion: Math.round(650 * factor),
    lifepo4: Math.round(4500 * factor),
  };
}

function enduranceMultiplier(tempC: number): number {
  if (tempC <= 30) return 1.0;
  if (tempC <= 40) return 1.0 - (tempC - 30) * 0.005;
  return Math.max(0.60, 0.95 - (tempC - 40) * 0.02);
}

/* Material data */
interface PolymerMaterial {
  name: string;
  tg: number;
  hdt: number | null;
  uv: string;
  process: string;
  use: string;
  color: string;
}

const MATERIALS: PolymerMaterial[] = [
  { name: 'PLA', tg: 60, hdt: null, uv: 'Poor', process: 'FDM', use: 'PROHIBITED', color: '#f0506e' },
  { name: 'PETG / PETG-CF', tg: 80, hdt: 70, uv: 'Fair', process: 'FDM', use: 'PROHIBITED', color: '#f97316' },
  { name: 'ASA', tg: 100, hdt: 98, uv: 'Best', process: 'FDM', use: 'Sun-exposed surfaces, nacelles', color: '#2dd4a0' },
  { name: 'GF-Nylon', tg: 95, hdt: 110, uv: 'Fair', process: 'FDM', use: 'Payload bays (RF-transparent)', color: '#1a6bff' },
  { name: 'PA12-CF (ann.)', tg: 108, hdt: 131, uv: 'Fair', process: 'FDM', use: 'Spars, structural members, booms', color: '#6366f1' },
  { name: 'PC / PC-CF', tg: 147, hdt: 150, uv: 'Poor', process: 'FDM', use: 'Motor mounts, high-heat zones', color: '#8b5cf6' },
  { name: 'SLS PA12', tg: 45, hdt: 171, uv: 'Fair', process: 'SLS', use: 'Production airframe skins & ribs', color: '#06b6d4' },
  { name: 'PPS-GF20', tg: 89, hdt: 236, uv: 'Good', process: 'FDM', use: 'Extreme heat, flame-retardant', color: '#0891b2' },
];

/* Tooltip components */
function PhysicsTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="tt-model">{label}°C</div>
      {payload.map((p, i) => (
        <div key={i} className="tt-row">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="tt-val">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}%</span>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════
 * MAIN COMPONENT
 * ════════════════════════════════════════════ */
export default function ComponentPhysicsTab() {
  const [ambientC, setAmbientC] = useState(45);
  const [elevM, setElevM] = useState(0);
  const [surfaceType, setSurfaceType] = useState<'asphalt' | 'concrete'>('asphalt');
  const [activeSection, setActiveSection] = useState<'propulsion' | 'battery' | 'airframe'>('propulsion');

  /* Preset temperature options */
  const TEMP_PRESETS = [
    { value: 0,  label: '0°C',  labelF: '32°F',  desc: 'Freezing' },
    { value: 15, label: '15°C', labelF: '59°F',  desc: 'ISA Std' },
    { value: 20, label: '20°C', labelF: '68°F',  desc: 'Mild' },
    { value: 30, label: '30°C', labelF: '86°F',  desc: 'Warm' },
    { value: 40, label: '40°C', labelF: '104°F', desc: 'Hot' },
    { value: 45, label: '45°C', labelF: '113°F', desc: 'Extreme' },
    { value: 50, label: '50°C', labelF: '122°F', desc: '50+' },
  ] as const;

  /* Computed values */
  const rho = airDensity(ambientC, elevM);
  const da = densityAltitudeFt(ambientC, elevM);
  const tarmac = tarmacTemp(ambientC, surfaceType);
  const winding = motorWindingTemp(ambientC);
  const cuR = cuResistanceIncrease(winding);
  const flux = ndfebFluxLoss(winding);
  const mosfet = mosfetRdsIncrease(winding);
  const thrustLoss = thrustReductionPct(ambientC, elevM);
  const rpmUp = rpmIncreaseNeeded(ambientC, elevM);
  const powerUp = powerIncreaseForThrust(ambientC, elevM);
  const hover = hoverPowerEscalation(ambientC, elevM);
  const battStatus = batteryStatus(ambientC);
  const cycles = cycleLife(ambientC);
  const endMult = enduranceMultiplier(ambientC);

  /* Degradation curve data for line chart */
  const degradationCurve = useMemo(() => {
    const points = [];
    for (let t = 15; t <= 55; t += 1) {
      const h = hoverPowerEscalation(t, elevM);
      points.push({
        temp: t,
        aero: h.aero,
        motor: h.motor,
        esc_batt: h.esc_batt,
        total: h.total,
      });
    }
    return points;
  }, [elevM]);

  /* Endurance curve */
  const enduranceCurve = useMemo(() => {
    const points = [];
    for (let t = 15; t <= 55; t += 1) {
      points.push({
        temp: t,
        multiplier: Math.round(enduranceMultiplier(t) * 100),
        cycles_lipo: cycleLife(t).lipo,
        cycles_liion: cycleLife(t).liion,
      });
    }
    return points;
  }, []);

  /* Material bar data */
  const materialBars = MATERIALS.map(m => ({
    ...m,
    barValue: m.hdt ?? m.tg,
    survives: (m.hdt ?? m.tg) > tarmac,
  }));

  const elevLabel = elevM === 0 ? 'Sea Level' : elevM === 800 ? '800m (Amman)' : '1,500m (Kurdistan)';

  return (
    <div className="physics-tab">
      <h2>Component Thermal Physics</h2>
      <p className="section-desc">
        Interactive degradation model based on the sUAS desert engineering white paper.
        Adjust ambient temperature and elevation to see compound effects across battery,
        propulsion, and airframe subsystems.
      </p>

      {/* ── Environment Controls ── */}
      <div className="physics-controls">
        <div className="physics-control-card">
          <div className="control-row">
            <div className="control-group" style={{ flex: 2 }}>
              <div className="constraint-header">
                <span className="constraint-label">Ambient Temperature</span>
                <span className="constraint-value" style={{
                  color: ambientC >= 50 ? '#ff6b6b' : ambientC >= 45 ? '#f0506e' : ambientC >= 35 ? '#f0a030' : '#2dd4a0'
                }}>{ambientC}°C / {Math.round(ambientC * 9 / 5 + 32)}°F</span>
              </div>
              <div className="temp-presets">
                {TEMP_PRESETS.map(p => (
                  <button key={p.value}
                    className={`temp-preset-btn ${ambientC === p.value ? 'active' : ''} ${p.value >= 45 ? 'hot' : p.value >= 35 ? 'warm' : ''}`}
                    onClick={() => setAmbientC(p.value)}>
                    <span className="temp-preset-deg">{p.label}</span>
                    <span className="temp-preset-desc">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="control-group" style={{ flex: 1 }}>
              <div className="constraint-header">
                <span className="constraint-label">Elevation</span>
                <span className="constraint-value">{elevLabel}</span>
              </div>
              <div className="group-toggles">
                {([0, 800, 1500] as const).map(e => (
                  <button key={e} className={`group-toggle-btn ${elevM === e ? 'g2 active' : ''}`}
                    onClick={() => setElevM(e)}>{e === 0 ? 'Sea Lvl' : `${e}m`}</button>
                ))}
              </div>
            </div>
            <div className="control-group" style={{ flex: 1 }}>
              <div className="constraint-header">
                <span className="constraint-label">Surface Type</span>
                <span className="constraint-value">{surfaceType === 'asphalt' ? 'Asphalt (Dark)' : 'Concrete (Light)'}</span>
              </div>
              <div className="group-toggles">
                <button className={`group-toggle-btn ${surfaceType === 'asphalt' ? 'g3 active' : ''}`}
                  onClick={() => setSurfaceType('asphalt')}>Asphalt</button>
                <button className={`group-toggle-btn ${surfaceType === 'concrete' ? 'g1 active' : ''}`}
                  onClick={() => setSurfaceType('concrete')}>Concrete</button>
              </div>
            </div>
          </div>
        </div>

        {/* Environment readouts */}
        <div className="env-readouts">
          {[
            { l: 'Air Density', v: `${rho.toFixed(3)} kg/m³`, sub: `${((1 - rho / ISA_DENSITY) * 100).toFixed(1)}% below ISA`, warn: rho < 1.05 },
            { l: 'Density Altitude', v: `${da.toLocaleString()} ft`, sub: elevLabel, warn: da > 4000 },
            { l: 'Tarmac Surface', v: `${tarmac}°C / ${Math.round(tarmac * 9 / 5 + 32)}°F`, sub: `${surfaceType === 'asphalt' ? 'Asphalt' : 'Concrete'} (+${tarmac - ambientC}°C soak)`, warn: tarmac > 60 },
            { l: 'Motor Winding Est.', v: `${winding}°C`, sub: 'Ambient + 70°C rise', warn: winding > 110 },
          ].map((r, i) => (
            <div key={i} className={`env-readout ${r.warn ? 'warn' : ''}`}>
              <div className="spec-label">{r.l}</div>
              <div className="env-readout-value">{r.v}</div>
              <div className="env-readout-sub">{r.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Subsystem tabs ── */}
      <div className="tabs" style={{ maxWidth: 500, marginBottom: 16 }}>
        {([
          ['propulsion', 'Propulsion Cascade'],
          ['battery', 'Battery Survival'],
          ['airframe', 'Airframe Materials'],
        ] as const).map(([key, label]) => (
          <button key={key}
            className={`tab-btn ${activeSection === key ? 'active' : ''}`}
            onClick={() => setActiveSection(key)}>
            {label}
          </button>
        ))}
      </div>

      {/* ═══════ PROPULSION SECTION ═══════ */}
      {activeSection === 'propulsion' && (
        <div className="physics-section-content">
          <div className="cascade-grid">
            <div className="cascade-card root">
              <div className="cascade-label">Ambient</div>
              <div className="cascade-big">{ambientC}°C</div>
            </div>
            <div className="cascade-arrow">→</div>
            <div className={`cascade-card ${thrustLoss > 10 ? 'danger' : 'warn'}`}>
              <div className="cascade-label">Prop Thrust</div>
              <div className="cascade-big">↓{thrustLoss.toFixed(1)}%</div>
              <div className="cascade-sub">ρ = {rho.toFixed(3)}</div>
            </div>
            <div className="cascade-arrow">→</div>
            <div className={`cascade-card ${cuR > 30 ? 'danger' : 'warn'}`}>
              <div className="cascade-label">Cu Resistance</div>
              <div className="cascade-big">↑{cuR.toFixed(0)}%</div>
              <div className="cascade-sub">at {winding}°C winding</div>
            </div>
            <div className="cascade-arrow">→</div>
            <div className={`cascade-card ${flux > 8 ? 'danger' : 'warn'}`}>
              <div className="cascade-label">NdFeB Flux</div>
              <div className="cascade-big">↓{flux.toFixed(1)}%</div>
              <div className="cascade-sub">magnet derating</div>
            </div>
            <div className="cascade-arrow">→</div>
            <div className={`cascade-card ${mosfet > 50 ? 'danger' : 'warn'}`}>
              <div className="cascade-label">MOSFET RDS(on)</div>
              <div className="cascade-big">↑{mosfet.toFixed(0)}%</div>
              <div className="cascade-sub">ESC thermal</div>
            </div>
          </div>

          <div className="cascade-result">
            <div className="cascade-result-row">
              <span>RPM increase needed to recover thrust</span>
              <span className="cascade-result-val">+{rpmUp.toFixed(1)}%</span>
            </div>
            <div className="cascade-result-row">
              <span>Power increase (n³ scaling) for thrust recovery</span>
              <span className="cascade-result-val" style={{ color: powerUp > 15 ? '#f0506e' : '#f0a030' }}>+{powerUp.toFixed(1)}%</span>
            </div>
            <div className="cascade-result-row highlight">
              <span>Total hover power demand increase</span>
              <span className="cascade-result-val" style={{ color: hover.total > 30 ? '#ff6b6b' : '#f0506e', fontSize: 18 }}>+{hover.total}%</span>
            </div>
            <div className="cascade-result-row">
              <span>Recommended motor derate</span>
              <span className="cascade-result-val">{ambientC >= 45 ? '70–75%' : ambientC >= 35 ? '80–85%' : '100%'} of rated current</span>
            </div>
            <div className="cascade-result-row">
              <span>Hover endurance multiplier</span>
              <span className="cascade-result-val" style={{ color: endMult < 0.7 ? '#ff6b6b' : '#f0506e' }}>×{endMult.toFixed(2)}</span>
            </div>
          </div>

          {/* Hover power escalation chart */}
          <div className="chart-card" style={{ marginTop: 20 }}>
            <h3>Hover Power Demand vs Temperature (at {elevLabel})</h3>
            <p className="chart-subtitle">Stacked component contributions to total power increase</p>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={degradationCurve} margin={{ left: 10, right: 20, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a38" />
                <XAxis dataKey="temp" tick={{ fontSize: 11, fill: '#556272' }}
                  label={{ value: 'Ambient °C', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#556272' }} />
                <YAxis tick={{ fontSize: 11, fill: '#556272' }}
                  label={{ value: '% Increase', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#556272' }} />
                <Tooltip content={<PhysicsTooltip />} />
                <ReferenceLine x={ambientC} stroke="#e8ecf1" strokeDasharray="4 4" strokeWidth={2} />
                <Area type="monotone" dataKey="aero" stackId="1" name="Aerodynamic" fill="#4ea4f6" fillOpacity={0.3} stroke="#4ea4f6" />
                <Area type="monotone" dataKey="motor" stackId="1" name="Motor I²R" fill="#f0506e" fillOpacity={0.3} stroke="#f0506e" />
                <Area type="monotone" dataKey="esc_batt" stackId="1" name="ESC + Battery" fill="#f0a030" fillOpacity={0.3} stroke="#f0a030" />
                <Line type="monotone" dataKey="total" name="Total" stroke="#e8ecf1" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="legend-row">
              <div className="legend-item"><div className="legend-dot" style={{ background: '#1a6bff' }} />Aerodynamic (thin air)</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#f0506e' }} />Motor I²R losses</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#f0a030' }} />ESC + Battery</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#e8ecf1' }} />Total</div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ BATTERY SECTION ═══════ */}
      {activeSection === 'battery' && (
        <div className="physics-section-content">
          {/* Go/No-Go status */}
          <div className="batt-gonogo" style={{ borderColor: battStatus.color }}>
            <div className="gonogo-badge" style={{ background: battStatus.color }}>{battStatus.label}</div>
            <div className="gonogo-desc">{battStatus.desc}</div>
            <div className="gonogo-temp">Battery temp: {ambientC}°C (ambient-matched for ground standby)</div>
          </div>

          {/* Chemistry comparison */}
          <div className="chart-card">
            <h3>Battery Chemistry at {ambientC}°C</h3>
            <p className="chart-subtitle">Estimated cycle life and characteristics by chemistry type</p>
            <div className="chem-table">
              <div className="chem-header">
                <span>Chemistry</span><span>Wh/kg</span><span>Std Cycles</span><span>At {ambientC}°C</span>
                <span>Thermal Onset</span><span>Desert Rating</span>
              </div>
              {[
                { name: 'LiPo (NMC)', whkg: '180–250', stdCycles: '300–500', hotCycles: cycles.lipo, onset: '150°C', rating: ambientC < 40 ? 'Good' : ambientC < 50 ? 'Fair' : 'Poor' },
                { name: 'Li-ion (NMC)', whkg: '200–265', stdCycles: '500–800', hotCycles: cycles.liion, onset: '150°C', rating: ambientC < 45 ? 'Good' : ambientC < 50 ? 'Fair' : 'Poor' },
                { name: 'LiFePO4', whkg: '90–160', stdCycles: '2,000–7,000', hotCycles: cycles.lifepo4, onset: '270°C', rating: 'Best' },
              ].map((c, i) => (
                <div key={i} className="chem-row">
                  <span className="chem-name">{c.name}</span>
                  <span>{c.whkg}</span>
                  <span>{c.stdCycles}</span>
                  <span className={`chem-hot ${c.hotCycles < 200 ? 'critical' : c.hotCycles < 400 ? 'warn' : ''}`}>
                    ~{c.hotCycles}
                  </span>
                  <span>{c.onset}</span>
                  <span className={`chem-rating ${c.rating.toLowerCase()}`}>{c.rating}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Endurance & cycle life curves */}
          <div className="chart-card" style={{ marginTop: 16 }}>
            <h3>Endurance Retention vs Temperature</h3>
            <p className="chart-subtitle">Percentage of standard-day endurance retained as temperature rises</p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={enduranceCurve} margin={{ left: 10, right: 20, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a38" />
                <XAxis dataKey="temp" tick={{ fontSize: 11, fill: '#556272' }}
                  label={{ value: 'Ambient °C', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#556272' }} />
                <YAxis domain={[55, 105]} tick={{ fontSize: 11, fill: '#556272' }}
                  label={{ value: '% Retained', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#556272' }} />
                <Tooltip content={<PhysicsTooltip />} />
                <ReferenceLine x={ambientC} stroke="#e8ecf1" strokeDasharray="4 4" strokeWidth={2} />
                <ReferenceLine y={70} stroke="#f0506e" strokeDasharray="3 3" label={{ value: '0.70× floor', position: 'right', fontSize: 10, fill: '#f0506e' }} />
                <Line type="monotone" dataKey="multiplier" name="Endurance" stroke="#4ea4f6" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Mitigation checklist */}
          <div className="mitigation-card">
            <h3>Thermal Mitigation Protocol</h3>
            <div className="mitigation-list">
              {[
                { temp: 50, text: 'NTC thermistor interlock: WARN at 50°C', active: ambientC >= 50 },
                { temp: 55, text: 'NTC thermistor interlock: RTL at 55°C', active: ambientC >= 55 },
                { temp: 60, text: 'NTC thermistor interlock: EMERGENCY LAND at 60°C', active: false },
                { temp: 0, text: 'Phase-change material (PCM) transitioning at ~52°C', active: ambientC >= 45 },
                { temp: 0, text: 'Reflective thermal blanket (reduces solar load 80%+)', active: ambientC >= 35 },
                { temp: 0, text: '30–60 min shade rest before recharging', active: ambientC >= 40 },
              ].map((m, i) => (
                <div key={i} className={`mitigation-item ${m.active ? 'active' : ''}`}>
                  <span className="mitigation-dot" style={{ background: m.active ? '#f0506e' : '#1e2a38' }} />
                  <span>{m.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ AIRFRAME SECTION ═══════ */}
      {activeSection === 'airframe' && (
        <div className="physics-section-content">
          <div className="chart-card">
            <h3>Polymer Thermal Survival Map</h3>
            <p className="chart-subtitle">
              Material Tg/HDT vs tarmac soak temperature ({tarmac}°C).
              Materials below the red line will deform or fail during ground standby.
            </p>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={materialBars} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a38" horizontal={false} />
                <XAxis type="number" domain={[0, 260]} tick={{ fontSize: 11, fill: '#556272' }}
                  label={{ value: 'Temperature (°C)', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#556272' }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#8a97a8' }} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof materialBars)[0];
                  return (
                    <div className="custom-tooltip">
                      <div className="tt-model">{d.name}</div>
                      <div className="tt-mfr">{d.process}</div>
                      <div className="tt-row"><span>Tg</span><span className="tt-val">{d.tg}°C</span></div>
                      {d.hdt && <div className="tt-row"><span>HDT</span><span className="tt-val">{d.hdt}°C</span></div>}
                      <div className="tt-row"><span>UV</span><span className="tt-val">{d.uv}</span></div>
                      <div className="tt-row"><span>Use</span><span className="tt-val">{d.use}</span></div>
                      <div className="tt-row">
                        <span>Status</span>
                        <span className="tt-val" style={{ color: d.survives ? '#2dd4a0' : '#f0506e' }}>
                          {d.survives ? 'SURVIVES' : 'FAILS'}
                        </span>
                      </div>
                    </div>
                  );
                }} />
                <ReferenceLine x={tarmac} stroke="#f0506e" strokeWidth={2} strokeDasharray="4 4"
                  label={{ value: `Tarmac ${tarmac}°C`, position: 'top', fontSize: 10, fill: '#f0506e' }} />
                <Bar dataKey="barValue" radius={[0, 4, 4, 0]}>
                  {materialBars.map((m, i) => (
                    <Cell key={i}
                      fill={m.survives ? m.color : '#f0506e'}
                      fillOpacity={m.survives ? 0.8 : 0.35}
                      stroke={m.survives ? m.color : '#f0506e'}
                      strokeWidth={1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="legend-row">
              <div className="legend-item"><div className="legend-dot" style={{ background: '#2dd4a0' }} />Survives tarmac soak</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#f0506e', opacity: 0.35 }} />Fails / Prohibited</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#f0506e' }} />Tarmac temp threshold</div>
            </div>
          </div>

          {/* Recommended materials table */}
          <div className="chart-card" style={{ marginTop: 16 }}>
            <h3>Recommended Materials for {ambientC}°C Operations</h3>
            <p className="chart-subtitle">From white paper Table 2 — materials that survive tarmac soak at {tarmac}°C</p>
            <div className="mat-table">
              <div className="mat-header">
                <span>Material</span><span>Process</span><span>Tg (°C)</span><span>HDT (°C)</span>
                <span>UV</span><span>Best Use</span><span>Status</span>
              </div>
              {MATERIALS.map((m, i) => {
                const threshold = m.hdt ?? m.tg;
                const ok = threshold > tarmac;
                return (
                  <div key={i} className={`mat-row ${ok ? '' : 'fail'}`}>
                    <span className="mat-name">{m.name}</span>
                    <span>{m.process}</span>
                    <span>{m.tg}</span>
                    <span>{m.hdt ?? '—'}</span>
                    <span>{m.uv}</span>
                    <span className="mat-use">{m.use}</span>
                    <span className={`mat-status ${ok ? 'ok' : 'fail'}`}>{ok ? '✓' : '✗'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Surface color imperative */}
          <div className="mitigation-card">
            <h3>Surface Heat Soak Comparison</h3>
            <div className="surface-compare">
              <div className="surface-box black">
                <div className="surface-label">Asphalt (Albedo 0.05–0.15)</div>
                <div className="surface-delta">+{tarmacTemp(ambientC, 'asphalt') - ambientC}°C above ambient</div>
                <div className="surface-temp">{tarmacTemp(ambientC, 'asphalt')}°C surface</div>
              </div>
              <div className="surface-vs">vs</div>
              <div className="surface-box white">
                <div className="surface-label">Concrete (Albedo 0.25–0.40)</div>
                <div className="surface-delta">+{tarmacTemp(ambientC, 'concrete') - ambientC}°C above ambient</div>
                <div className="surface-temp">{tarmacTemp(ambientC, 'concrete')}°C surface</div>
              </div>
            </div>
            <p className="surface-note">
              Asphalt absorbs 85–95% of solar energy; at {ambientC}°C ambient, surfaces reach {tarmacTemp(ambientC, 'asphalt')}°C after hours of heat soak.
              Concrete reflects 20–40%, staying {tarmacTemp(ambientC, 'asphalt') - tarmacTemp(ambientC, 'concrete')}°C cooler at {tarmacTemp(ambientC, 'concrete')}°C.
              {ambientC >= 35 && ' Every sUAS for hot-climate operations must be white or light silver.'}
              {ambientC >= 35 && ' Cerakote ceramic-polymer coatings (12–25 µm) deliver UV stability exceeding 1,000 hrs QUV weathering.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
