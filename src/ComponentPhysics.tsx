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

function tarmacTemp(ambientC: number, surfaceColor: 'white' | 'black'): number {
  const delta = surfaceColor === 'black' ? 30 + (ambientC - 30) * 0.3 : 10 + (ambientC - 30) * 0.1;
  return Math.round(ambientC + Math.max(delta, surfaceColor === 'black' ? 20 : 8));
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
  if (tempC < 30) return { label: 'GO', color: '#0d9f6e', desc: 'Proceed to launch' };
  if (tempC < 50) return { label: 'COOL DOWN', color: '#c47d0a', desc: 'DC cooler + shade. Target 25°C' };
  if (tempC < 55) return { label: 'DERATE', color: '#d6336c', desc: '25% endurance penalty. Cool before charging' };
  return { label: 'NO-GO', color: '#991b1b', desc: 'Do not fly. Immediate cooling required' };
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
  { name: 'PLA', tg: 60, hdt: null, uv: 'Poor', process: 'FDM', use: 'PROHIBITED', color: '#ef4444' },
  { name: 'PETG / PETG-CF', tg: 80, hdt: 70, uv: 'Fair', process: 'FDM', use: 'PROHIBITED', color: '#f97316' },
  { name: 'ASA', tg: 100, hdt: 98, uv: 'Best', process: 'FDM', use: 'Sun-exposed surfaces, nacelles', color: '#0d9f6e' },
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
  const [surfaceColor, setSurfaceColor] = useState<'white' | 'black'>('black');
  const [activeSection, setActiveSection] = useState<'propulsion' | 'battery' | 'airframe'>('propulsion');

  /* Computed values */
  const rho = airDensity(ambientC, elevM);
  const da = densityAltitudeFt(ambientC, elevM);
  const tarmac = tarmacTemp(ambientC, surfaceColor);
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
                  color: ambientC >= 50 ? '#991b1b' : ambientC >= 45 ? '#d6336c' : ambientC >= 35 ? '#c47d0a' : '#0d9f6e'
                }}>{ambientC}°C / {Math.round(ambientC * 9 / 5 + 32)}°F</span>
              </div>
              <input type="range" className="range-slider" min={15} max={55} step={1}
                value={ambientC} onChange={e => setAmbientC(+e.target.value)} />
              <div className="range-marks">
                <span>15°C ISA</span><span>30°C</span><span>45°C</span><span>55°C</span>
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
                <span className="constraint-label">Surface Color</span>
                <span className="constraint-value">{surfaceColor === 'black' ? 'Dark/Asphalt' : 'White/Cerakote'}</span>
              </div>
              <div className="group-toggles">
                <button className={`group-toggle-btn ${surfaceColor === 'black' ? 'g3 active' : ''}`}
                  onClick={() => setSurfaceColor('black')}>Dark</button>
                <button className={`group-toggle-btn ${surfaceColor === 'white' ? 'g1 active' : ''}`}
                  onClick={() => setSurfaceColor('white')}>White</button>
              </div>
            </div>
          </div>
        </div>

        {/* Environment readouts */}
        <div className="env-readouts">
          {[
            { l: 'Air Density', v: `${rho.toFixed(3)} kg/m³`, sub: `${((1 - rho / ISA_DENSITY) * 100).toFixed(1)}% below ISA`, warn: rho < 1.05 },
            { l: 'Density Altitude', v: `${da.toLocaleString()} ft`, sub: elevLabel, warn: da > 4000 },
            { l: 'Tarmac Surface', v: `${tarmac}°C / ${Math.round(tarmac * 9 / 5 + 32)}°F`, sub: `${surfaceColor} surface`, warn: tarmac > 70 },
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
              <span className="cascade-result-val" style={{ color: powerUp > 15 ? '#d6336c' : '#c47d0a' }}>+{powerUp.toFixed(1)}%</span>
            </div>
            <div className="cascade-result-row highlight">
              <span>Total hover power demand increase</span>
              <span className="cascade-result-val" style={{ color: hover.total > 30 ? '#991b1b' : '#d6336c', fontSize: 18 }}>+{hover.total}%</span>
            </div>
            <div className="cascade-result-row">
              <span>Recommended motor derate</span>
              <span className="cascade-result-val">{ambientC >= 45 ? '70–75%' : ambientC >= 35 ? '80–85%' : '100%'} of rated current</span>
            </div>
            <div className="cascade-result-row">
              <span>Hover endurance multiplier</span>
              <span className="cascade-result-val" style={{ color: endMult < 0.7 ? '#991b1b' : '#d6336c' }}>×{endMult.toFixed(2)}</span>
            </div>
          </div>

          {/* Hover power escalation chart */}
          <div className="chart-card" style={{ marginTop: 20 }}>
            <h3>Hover Power Demand vs Temperature (at {elevLabel})</h3>
            <p className="chart-subtitle">Stacked component contributions to total power increase</p>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={degradationCurve} margin={{ left: 10, right: 20, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
                <XAxis dataKey="temp" tick={{ fontSize: 11, fill: '#8994a6' }}
                  label={{ value: 'Ambient °C', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#8994a6' }} />
                <YAxis tick={{ fontSize: 11, fill: '#8994a6' }}
                  label={{ value: '% Increase', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#8994a6' }} />
                <Tooltip content={<PhysicsTooltip />} />
                <ReferenceLine x={ambientC} stroke="#1a2332" strokeDasharray="4 4" strokeWidth={2} />
                <Area type="monotone" dataKey="aero" stackId="1" name="Aerodynamic" fill="#1a6bff" fillOpacity={0.3} stroke="#1a6bff" />
                <Area type="monotone" dataKey="motor" stackId="1" name="Motor I²R" fill="#d6336c" fillOpacity={0.3} stroke="#d6336c" />
                <Area type="monotone" dataKey="esc_batt" stackId="1" name="ESC + Battery" fill="#c47d0a" fillOpacity={0.3} stroke="#c47d0a" />
                <Line type="monotone" dataKey="total" name="Total" stroke="#1a2332" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="legend-row">
              <div className="legend-item"><div className="legend-dot" style={{ background: '#1a6bff' }} />Aerodynamic (thin air)</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#d6336c' }} />Motor I²R losses</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#c47d0a' }} />ESC + Battery</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#1a2332' }} />Total</div>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
                <XAxis dataKey="temp" tick={{ fontSize: 11, fill: '#8994a6' }}
                  label={{ value: 'Ambient °C', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#8994a6' }} />
                <YAxis domain={[55, 105]} tick={{ fontSize: 11, fill: '#8994a6' }}
                  label={{ value: '% Retained', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#8994a6' }} />
                <Tooltip content={<PhysicsTooltip />} />
                <ReferenceLine x={ambientC} stroke="#1a2332" strokeDasharray="4 4" strokeWidth={2} />
                <ReferenceLine y={70} stroke="#d6336c" strokeDasharray="3 3" label={{ value: '0.70× floor', position: 'right', fontSize: 10, fill: '#d6336c' }} />
                <Line type="monotone" dataKey="multiplier" name="Endurance" stroke="#1a6bff" strokeWidth={2.5} dot={false} />
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
                  <span className="mitigation-dot" style={{ background: m.active ? '#d6336c' : '#e2e6ec' }} />
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
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" horizontal={false} />
                <XAxis type="number" domain={[0, 260]} tick={{ fontSize: 11, fill: '#8994a6' }}
                  label={{ value: 'Temperature (°C)', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#8994a6' }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#5a6578' }} />
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
                        <span className="tt-val" style={{ color: d.survives ? '#0d9f6e' : '#d6336c' }}>
                          {d.survives ? 'SURVIVES' : 'FAILS'}
                        </span>
                      </div>
                    </div>
                  );
                }} />
                <ReferenceLine x={tarmac} stroke="#d6336c" strokeWidth={2} strokeDasharray="4 4"
                  label={{ value: `Tarmac ${tarmac}°C`, position: 'top', fontSize: 10, fill: '#d6336c' }} />
                <Bar dataKey="barValue" radius={[0, 4, 4, 0]}>
                  {materialBars.map((m, i) => (
                    <Cell key={i}
                      fill={m.survives ? m.color : '#ef4444'}
                      fillOpacity={m.survives ? 0.8 : 0.35}
                      stroke={m.survives ? m.color : '#ef4444'}
                      strokeWidth={1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="legend-row">
              <div className="legend-item"><div className="legend-dot" style={{ background: '#0d9f6e' }} />Survives tarmac soak</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#ef4444', opacity: 0.35 }} />Fails / Prohibited</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#d6336c' }} />Tarmac temp threshold</div>
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
            <h3>Surface Protection Imperative</h3>
            <div className="surface-compare">
              <div className="surface-box black">
                <div className="surface-label">Black Surface</div>
                <div className="surface-delta">+{Math.round(ambientC * 0.75)}°C above ambient</div>
                <div className="surface-temp">{Math.round(ambientC + ambientC * 0.75)}°C surface</div>
              </div>
              <div className="surface-vs">vs</div>
              <div className="surface-box white">
                <div className="surface-label">White / Cerakote</div>
                <div className="surface-delta">+~10°C above ambient</div>
                <div className="surface-temp">{ambientC + 10}°C surface</div>
              </div>
            </div>
            <p className="surface-note">
              Every sUAS for Middle East operations must be white or light silver.
              Cerakote ceramic-polymer coatings at 12–25 µm deliver UV stability exceeding 1,000 hrs QUV weathering.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
