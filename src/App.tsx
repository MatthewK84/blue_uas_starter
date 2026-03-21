import { useState, useMemo } from 'react';
import { DRONES, formatTime, type Drone } from './data';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, CartesianGrid, Cell, ZAxis
} from 'recharts';

const MISSIONS = [...new Set(DRONES.map(d => d.mission))].sort();

function FlightBar({ minutes, max }: { minutes: number; max: number }) {
  const capped = Math.min(minutes, 800);
  const pct = (capped / max) * 100;
  const color = minutes >= 9999 ? '#0d9f6e'
    : minutes >= 360 ? '#c47d0a'
    : minutes >= 120 ? '#1a6bff'
    : minutes >= 60 ? '#6366f1'
    : '#a4afc0';
  const bg = minutes >= 9999
    ? 'repeating-linear-gradient(90deg,#0d9f6e 0px,#0d9f6e 6px,transparent 6px,transparent 10px)'
    : `linear-gradient(90deg,${color}cc,${color})`;
  return (
    <div className="flight-bar-track">
      <div className="flight-bar-fill"
        style={{ width: minutes >= 9999 ? '100%' : `${Math.max(pct, 3)}%`, background: bg }} />
    </div>
  );
}

function GroupBadge({ group }: { group: number }) {
  return <div className={`group-badge g${group}`}>{group}</div>;
}

function DroneCard({ drone, isExpanded, onToggle, index }: {
  drone: Drone; isExpanded: boolean; onToggle: () => void; index: number;
}) {
  return (
    <div className={`drone-card ${isExpanded ? 'expanded' : ''}`}
      onClick={onToggle}
      style={{ animation: `fadeUp 0.35s ease ${index * 0.015}s both` }}>
      <div className="top-row">
        <GroupBadge group={drone.group} />
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span className="model-name">{drone.model}</span>
            <span className="mfr-name">{drone.manufacturer}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <span className="type-tag">{drone.type}</span>
            <span className="mission-tag">{drone.mission}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="flight-time-display">
            <div className={`value ${drone.tethered ? 'unlimited' : ''}`}>
              {formatTime(drone.flight_time_min)}
            </div>
            <div className="label">flight time</div>
          </div>
          <FlightBar minutes={drone.flight_time_min} max={800} />
          <span className={`chevron ${isExpanded ? 'open' : ''}`}>▾</span>
        </div>
      </div>
      {isExpanded && (
        <div className="drone-detail">
          <div className="spec-grid">
            {[
              { l: 'Max Speed', v: drone.max_speed_mph > 0 ? `${drone.max_speed_mph} mph` : 'N/A' },
              { l: 'Range', v: drone.range_mi > 0 ? `${drone.range_mi} mi` : 'Tethered' },
              { l: 'Weight', v: `${drone.weight_lbs} lbs` },
              { l: 'Payload', v: `${drone.payload_lbs} lbs` },
              { l: 'UAS Group', v: `Group ${drone.group}`, a: true },
              { l: 'Power Source', v: drone.power_source },
              { l: 'Max Temp Rating', v: `${drone.operating_temp_max_c}°C` },
              { l: 'Hot Endurance (>45°C)', v: formatTime(drone.hot_endurance_min), a: true },
            ].map((s, i) => (
              <div key={i} className="spec-item">
                <div className="spec-label">{s.l}</div>
                <div className={`spec-value ${s.a ? 'accent' : ''}`}>{s.v}</div>
              </div>
            ))}
          </div>
          <p className="drone-desc">{drone.desc}</p>
        </div>
      )}
    </div>
  );
}

/* Custom Tooltip for charts */
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="custom-tooltip">
      <div className="tt-model">{d.model}</div>
      <div className="tt-mfr">{d.manufacturer}</div>
      {d.flight_time_min !== undefined && (
        <div className="tt-row"><span>Standard Endurance</span><span className="tt-val">{formatTime(d.flight_time_min)}</span></div>
      )}
      {d.hot_endurance_min !== undefined && (
        <div className="tt-row"><span>Hot Endurance (&gt;45°C)</span><span className="tt-val">{formatTime(d.hot_endurance_min)}</span></div>
      )}
      {d.range_mi !== undefined && d.range_mi > 0 && (
        <div className="tt-row"><span>Range</span><span className="tt-val">{d.range_mi} mi → {d.hot_range_mi} mi</span></div>
      )}
      {d.max_speed_mph !== undefined && d.max_speed_mph > 0 && (
        <div className="tt-row"><span>Speed</span><span className="tt-val">{d.max_speed_mph} → {d.hot_speed_mph} mph</span></div>
      )}
    </div>
  );
}

/* Performance Graphics Tab */
function PerformanceTab() {
  const [selectedDrone, setSelectedDrone] = useState<Drone | null>(null);
  const [activeChart, setActiveChart] = useState<'endurance' | 'range' | 'scatter'>('endurance');

  const nonTethered = DRONES.filter(d => !d.tethered);

  /* Endurance comparison sorted */
  const enduranceData = useMemo(() =>
    [...nonTethered]
      .sort((a, b) => b.flight_time_min - a.flight_time_min)
      .slice(0, 25)
      .map(d => ({
        ...d,
        name: d.model.length > 16 ? d.model.slice(0, 14) + '…' : d.model,
        reduction_pct: Math.round((1 - d.hot_endurance_min / d.flight_time_min) * 100),
      })),
    []
  );

  /* Range comparison */
  const rangeData = useMemo(() =>
    [...nonTethered]
      .filter(d => d.range_mi > 5)
      .sort((a, b) => b.range_mi - a.range_mi)
      .slice(0, 20)
      .map(d => ({
        ...d,
        name: d.model.length > 16 ? d.model.slice(0, 14) + '…' : d.model,
      })),
    []
  );

  /* Scatter: speed vs endurance at >45C */
  const scatterData = useMemo(() =>
    nonTethered.filter(d => d.hot_speed_mph > 0).map(d => ({
      ...d,
      x: d.hot_speed_mph,
      y: Math.min(d.hot_endurance_min, 500),
      z: d.weight_lbs,
    })),
    []
  );

  const gColors: Record<number, string> = { 1: '#0d9f6e', 2: '#1a6bff', 3: '#c47d0a' };

  function handleBarClick(data: any) {
    if (data?.id) {
      const drone = DRONES.find(d => d.id === data.id);
      if (drone) setSelectedDrone(drone);
    }
  }

  return (
    <div className="graphics-section">
      <h2>Hot-Weather Performance Analysis</h2>
      <p className="section-desc">
        Estimated platform performance at ambient temperatures above 45°C (113°F).
        LiPo batteries experience 15-20% endurance reduction; hybrid/fuel platforms 5-10%.
        Click any bar or data point for full specifications.
      </p>

      {selectedDrone && (
        <div className="drone-popup">
          <div className="popup-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <GroupBadge group={selectedDrone.group} />
                <span style={{ fontSize: 18, fontWeight: 700 }}>{selectedDrone.model}</span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {selectedDrone.manufacturer}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <span className="type-tag">{selectedDrone.type}</span>
                <span className="mission-tag">{selectedDrone.mission}</span>
                <span className="type-tag">{selectedDrone.power_source}</span>
              </div>
            </div>
            <button className="popup-close" onClick={() => setSelectedDrone(null)}>✕ Close</button>
          </div>
          <div className="spec-grid">
            <div className="spec-item">
              <div className="spec-label">Standard Endurance</div>
              <div className="spec-value">{formatTime(selectedDrone.flight_time_min)}</div>
            </div>
            <div className="spec-item">
              <div className="spec-label">Hot Endurance (&gt;45°C)</div>
              <div className="spec-value accent">{formatTime(selectedDrone.hot_endurance_min)}</div>
            </div>
            <div className="spec-item">
              <div className="spec-label">Endurance Loss</div>
              <div className="spec-value" style={{ color: 'var(--red)' }}>
                {selectedDrone.tethered ? '0%' : `-${Math.round((1 - selectedDrone.hot_endurance_min / selectedDrone.flight_time_min) * 100)}%`}
              </div>
            </div>
            <div className="spec-item">
              <div className="spec-label">Standard Range</div>
              <div className="spec-value">{selectedDrone.range_mi > 0 ? `${selectedDrone.range_mi} mi` : 'Tethered'}</div>
            </div>
            <div className="spec-item">
              <div className="spec-label">Hot Range (&gt;45°C)</div>
              <div className="spec-value accent">{selectedDrone.hot_range_mi > 0 ? `${selectedDrone.hot_range_mi} mi` : 'Tethered'}</div>
            </div>
            <div className="spec-item">
              <div className="spec-label">Hot Speed (&gt;45°C)</div>
              <div className="spec-value accent">{selectedDrone.hot_speed_mph > 0 ? `${selectedDrone.hot_speed_mph} mph` : 'N/A'}</div>
            </div>
            <div className="spec-item">
              <div className="spec-label">Max Temp Rating</div>
              <div className="spec-value">{selectedDrone.operating_temp_max_c}°C</div>
            </div>
            <div className="spec-item">
              <div className="spec-label">Weight / Payload</div>
              <div className="spec-value">{selectedDrone.weight_lbs} / {selectedDrone.payload_lbs} lbs</div>
            </div>
          </div>
          <p className="drone-desc">{selectedDrone.desc}</p>
        </div>
      )}

      {/* Sub-tabs for chart type */}
      <div className="tabs" style={{ maxWidth: 460, marginBottom: 16 }}>
        {([
          ['endurance', 'Endurance Comparison'],
          ['range', 'Range Comparison'],
          ['scatter', 'Speed vs Endurance']
        ] as const).map(([key, label]) => (
          <button key={key}
            className={`tab-btn ${activeChart === key ? 'active' : ''}`}
            onClick={() => setActiveChart(key)}>
            {label}
          </button>
        ))}
      </div>

      {/* Endurance chart */}
      {activeChart === 'endurance' && (
        <div className="chart-card">
          <h3>Endurance: Standard vs &gt;45°C (Top 25 Non-Tethered)</h3>
          <p className="chart-subtitle">Click any bar to view full platform specifications</p>
          <ResponsiveContainer width="100%" height={520}>
            <BarChart data={enduranceData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#8994a6' }}
                label={{ value: 'Minutes', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#8994a6' }} />
              <YAxis type="category" dataKey="name" width={120}
                tick={{ fontSize: 11, fill: '#5a6578' }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="flight_time_min" name="Standard" fill="#1a6bff" radius={[0, 3, 3, 0]}
                opacity={0.35} cursor="pointer" onClick={handleBarClick} />
              <Bar dataKey="hot_endurance_min" name=">45°C" fill="#d6336c" radius={[0, 3, 3, 0]}
                cursor="pointer" onClick={handleBarClick} />
            </BarChart>
          </ResponsiveContainer>
          <div className="legend-row">
            <div className="legend-item"><div className="legend-dot" style={{ background: '#1a6bff', opacity: 0.35 }} />Standard conditions</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#d6336c' }} />&gt;45°C / 113°F ambient</div>
          </div>
        </div>
      )}

      {/* Range chart */}
      {activeChart === 'range' && (
        <div className="chart-card">
          <h3>Operational Range: Standard vs &gt;45°C (Platforms &gt;5 mi)</h3>
          <p className="chart-subtitle">Click any bar to view full platform specifications</p>
          <ResponsiveContainer width="100%" height={460}>
            <BarChart data={rangeData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#8994a6' }}
                label={{ value: 'Miles', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#8994a6' }} />
              <YAxis type="category" dataKey="name" width={120}
                tick={{ fontSize: 11, fill: '#5a6578' }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="range_mi" name="Standard Range" fill="#0d9f6e" radius={[0, 3, 3, 0]}
                opacity={0.35} cursor="pointer" onClick={handleBarClick} />
              <Bar dataKey="hot_range_mi" name=">45°C Range" fill="#c47d0a" radius={[0, 3, 3, 0]}
                cursor="pointer" onClick={handleBarClick} />
            </BarChart>
          </ResponsiveContainer>
          <div className="legend-row">
            <div className="legend-item"><div className="legend-dot" style={{ background: '#0d9f6e', opacity: 0.35 }} />Standard range</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#c47d0a' }} />&gt;45°C / 113°F range</div>
          </div>
        </div>
      )}

      {/* Scatter chart */}
      {activeChart === 'scatter' && (
        <div className="chart-card">
          <h3>Cruise Speed vs Endurance at &gt;45°C (by UAS Group)</h3>
          <p className="chart-subtitle">Bubble size = platform weight. Click any point for details.</p>
          <ResponsiveContainer width="100%" height={440}>
            <ScatterChart margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
              <XAxis type="number" dataKey="x" name="Speed (mph)" tick={{ fontSize: 11, fill: '#8994a6' }}
                label={{ value: 'Hot Cruise Speed (mph)', position: 'insideBottom', offset: -4, fontSize: 11, fill: '#8994a6' }} />
              <YAxis type="number" dataKey="y" name="Endurance (min)" tick={{ fontSize: 11, fill: '#8994a6' }}
                label={{ value: 'Hot Endurance (min)', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#8994a6' }} />
              <ZAxis type="number" dataKey="z" range={[40, 400]} name="Weight (lbs)" />
              <Tooltip content={<ChartTooltip />} />
              <Scatter data={scatterData} cursor="pointer"
                onClick={(data: any) => { if (data?.id) { const dr = DRONES.find(dd => dd.id === data.id); if (dr) setSelectedDrone(dr); } }}>
                {scatterData.map((d, i) => (
                  <Cell key={i} fill={gColors[d.group] || '#8994a6'} fillOpacity={0.7} stroke={gColors[d.group]} strokeWidth={1} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="legend-row">
            <div className="legend-item"><div className="legend-dot" style={{ background: '#0d9f6e' }} />Group 1 (&lt;20 lbs)</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#1a6bff' }} />Group 2 (21-55 lbs)</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#c47d0a' }} />Group 3 (&gt;55 lbs)</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Mission Planner Tab */
const PRESETS: { name: string; desc: string; c: Partial<Constraints> }[] = [
  { name: 'Dismounted ISR', desc: 'Under 10 lbs, 30+ min, backpack-portable',
    c: { minEndurance: 30, maxWeight: 10, minRange: 1, groups: [1] } },
  { name: 'Persistent Overwatch', desc: '4+ hours endurance, any weight class',
    c: { minEndurance: 240, maxWeight: 200, minRange: 10 } },
  { name: 'Gulf Region ISR', desc: '1+ hour at >45°C, VTOL, hot-rated',
    c: { minEndurance: 60, maxWeight: 200, minRange: 5, requireVTOL: true, requireHotRated: true, useHotSpecs: true } },
  { name: 'Mapping / Survey', desc: '45+ min, 10+ mi range, sensor payload',
    c: { minEndurance: 45, maxWeight: 200, minRange: 10, minPayload: 1 } },
  { name: 'FPV / Strike', desc: 'Group 1, 50+ mph, payload for munitions',
    c: { minEndurance: 0, maxWeight: 10, minSpeed: 50, minPayload: 0.5, groups: [1] } },
  { name: 'Heavy Lift', desc: '10+ lbs payload capacity',
    c: { minEndurance: 0, maxWeight: 200, minPayload: 10 } },
];

interface Constraints {
  minEndurance: number; maxWeight: number; minRange: number;
  minPayload: number; minSpeed: number; requireVTOL: boolean;
  requireHotRated: boolean; groups: number[]; useHotSpecs: boolean;
}
const DEFAULTS: Constraints = {
  minEndurance: 0, maxWeight: 200, minRange: 0, minPayload: 0,
  minSpeed: 0, requireVTOL: false, requireHotRated: false,
  groups: [1, 2, 3], useHotSpecs: false,
};

function isVTOL(d: Drone): boolean {
  const t = d.type.toLowerCase();
  return t.includes('vtol') || t.includes('quad') || t.includes('coaxial')
    || t.includes('multi-rotor') || t.includes('octo') || t.includes('hexa')
    || t.includes('tethered') || t.includes('ducted') || t.includes('fpv');
}

function MissionPlannerTab() {
  const [c, setC] = useState<Constraints>({ ...DEFAULTS });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const up = (p: Partial<Constraints>) => setC(prev => ({ ...prev, ...p }));

  const results = useMemo(() => {
    return DRONES.filter(d => {
      const en = c.useHotSpecs ? d.hot_endurance_min : d.flight_time_min;
      const rn = c.useHotSpecs ? d.hot_range_mi : d.range_mi;
      const sp = c.useHotSpecs ? d.hot_speed_mph : d.max_speed_mph;
      if (en < c.minEndurance && !d.tethered) return false;
      if (d.weight_lbs > c.maxWeight) return false;
      if (rn < c.minRange && !d.tethered) return false;
      if (d.payload_lbs < c.minPayload) return false;
      if (sp < c.minSpeed && c.minSpeed > 0) return false;
      if (c.requireVTOL && !isVTOL(d)) return false;
      if (c.requireHotRated && d.operating_temp_max_c < 45) return false;
      if (!c.groups.includes(d.group)) return false;
      return true;
    }).sort((a, b) => {
      const ea = c.useHotSpecs ? a.hot_endurance_min : a.flight_time_min;
      const eb = c.useHotSpecs ? b.hot_endurance_min : b.flight_time_min;
      return eb - ea;
    });
  }, [c]);

  const activeCount = [
    c.minEndurance > 0, c.maxWeight < 200, c.minRange > 0,
    c.minPayload > 0, c.minSpeed > 0, c.requireVTOL, c.requireHotRated,
    c.groups.length < 3, c.useHotSpecs,
  ].filter(Boolean).length;

  function toggleGroup(g: number) {
    const cur = c.groups;
    if (cur.includes(g)) { if (cur.length > 1) up({ groups: cur.filter(x => x !== g) }); }
    else up({ groups: [...cur, g] });
  }

  return (
    <div className="planner-layout">
      <div className="planner-sidebar">
        <div className="planner-section">
          <h3 className="planner-section-title">Mission Presets</h3>
          <div className="preset-grid">
            {PRESETS.map((p, i) => (
              <button key={i} className="preset-btn" onClick={() => { setC({ ...DEFAULTS, ...p.c }); setExpandedId(null); }}>
                <span className="preset-name">{p.name}</span>
                <span className="preset-desc">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="planner-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="planner-section-title">Constraints</h3>
            {activeCount > 0 && (
              <button className="clear-btn" onClick={() => { setC({ ...DEFAULTS }); setExpandedId(null); }}>Clear all</button>
            )}
          </div>

          <div className="constraint-toggle-box" style={{ background: c.useHotSpecs ? 'var(--red-light)' : 'var(--bg)', borderColor: c.useHotSpecs ? 'var(--red)' : 'var(--border)' }}>
            <label className="toggle-label">
              <input type="checkbox" checked={c.useHotSpecs} onChange={e => up({ useHotSpecs: e.target.checked })} />
              <span className="toggle-text">Use &gt;45°C performance specs</span>
            </label>
            {c.useHotSpecs && <div className="toggle-hint">Filtering on hot-weather endurance, range, and speed</div>}
          </div>

          {([
            { key: 'minEndurance', label: 'Min Endurance', min: 0, max: 480, step: 5,
              fmt: (v: number) => v === 0 ? 'Any' : formatTime(v), marks: ['Any', '2h', '4h', '6h', '8h'] },
            { key: 'maxWeight', label: 'Max Weight', min: 1, max: 200, step: 1,
              fmt: (v: number) => v >= 200 ? 'Any' : `${v} lbs`, marks: ['1 lb', '50', '100', '150', 'Any'] },
            { key: 'minRange', label: 'Min Range', min: 0, max: 200, step: 5,
              fmt: (v: number) => v === 0 ? 'Any' : `${v} mi`, marks: ['Any', '50', '100', '150', '200'] },
            { key: 'minPayload', label: 'Min Payload', min: 0, max: 40, step: 0.5,
              fmt: (v: number) => v === 0 ? 'Any' : `${v} lbs`, marks: ['Any', '10', '20', '30', '40'] },
            { key: 'minSpeed', label: 'Min Speed', min: 0, max: 100, step: 5,
              fmt: (v: number) => v === 0 ? 'Any' : `${v} mph`, marks: ['Any', '25', '50', '75', '100'] },
          ] as const).map(s => (
            <div key={s.key} className="constraint-item">
              <div className="constraint-header">
                <span className="constraint-label">{s.label}</span>
                <span className="constraint-value">{s.fmt(c[s.key] as number)}</span>
              </div>
              <input type="range" className="range-slider" min={s.min} max={s.max} step={s.step}
                value={c[s.key] as number} onChange={e => up({ [s.key]: +e.target.value })} />
              <div className="range-marks">{s.marks.map((m, i) => <span key={i}>{m}</span>)}</div>
            </div>
          ))}

          <div className="constraint-item">
            <div className="constraint-header"><span className="constraint-label">UAS Group</span></div>
            <div className="group-toggles">
              {[1, 2, 3].map(g => (
                <button key={g} className={`group-toggle-btn g${g} ${c.groups.includes(g) ? 'active' : ''}`}
                  onClick={() => toggleGroup(g)}>Group {g}</button>
              ))}
            </div>
          </div>
          <div className="constraint-item">
            <label className="toggle-label">
              <input type="checkbox" checked={c.requireVTOL} onChange={e => up({ requireVTOL: e.target.checked })} />
              <span className="toggle-text">Require VTOL capability</span>
            </label>
          </div>
          <div className="constraint-item">
            <label className="toggle-label">
              <input type="checkbox" checked={c.requireHotRated} onChange={e => up({ requireHotRated: e.target.checked })} />
              <span className="toggle-text">Rated for ≥45°C operations</span>
            </label>
          </div>
        </div>
      </div>

      <div className="planner-results">
        <div className="planner-results-header">
          <h3>{results.length} platform{results.length !== 1 ? 's' : ''} match</h3>
          <span className="active-filters">{activeCount} constraint{activeCount !== 1 ? 's' : ''} active</span>
        </div>
        {results.length === 0 ? (
          <div className="planner-empty">
            <div className="planner-empty-icon">∅</div>
            <div className="planner-empty-text">No platforms match these constraints</div>
            <div className="planner-empty-hint">Try relaxing your requirements or using a preset</div>
          </div>
        ) : (
          <div className="drone-list">
            {results.map((d, i) => (
              <DroneCard key={d.id} drone={d} index={i}
                isExpanded={expandedId === d.id}
                onToggle={() => setExpandedId(expandedId === d.id ? null : d.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* Main App */
export default function App() {
  const [tab, setTab] = useState<'list' | 'graphics' | 'planner'>('list');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('flight_desc');
  const [filterMission, setFilterMission] = useState('All');
  const [filterGroup, setFilterGroup] = useState('All');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    let list = DRONES.filter(d => {
      const q = search.toLowerCase();
      const ms = !q || d.manufacturer.toLowerCase().includes(q) ||
        d.model.toLowerCase().includes(q) || d.type.toLowerCase().includes(q) ||
        d.mission.toLowerCase().includes(q);
      const mm = filterMission === 'All' || d.mission === filterMission;
      const mg = filterGroup === 'All' || d.group === Number(filterGroup);
      return ms && mm && mg;
    });
    const [key, dir] = sortKey.split('_');
    const mult = dir === 'desc' ? -1 : 1;
    const fieldMap: Record<string, keyof Drone> = {
      flight: 'flight_time_min', speed: 'max_speed_mph', weight: 'weight_lbs',
      range: 'range_mi', payload: 'payload_lbs', model: 'model',
    };
    const field = fieldMap[key] || 'model';
    list.sort((a, b) => {
      const av = a[field]; const bv = b[field];
      if (typeof av === 'string' && typeof bv === 'string') return mult * av.localeCompare(bv);
      return mult * ((av as number) - (bv as number));
    });
    return list;
  }, [search, sortKey, filterMission, filterGroup]);

  const stats = useMemo(() => {
    const nt = filtered.filter(d => !d.tethered);
    return {
      total: filtered.length,
      mfrs: new Set(filtered.map(d => d.manufacturer)).size,
      avgFlight: nt.length > 0 ? Math.round(nt.reduce((s, d) => s + d.flight_time_min, 0) / nt.length) : 0,
      maxFlight: nt.length > 0 ? Math.max(...nt.map(d => d.flight_time_min)) : 0,
    };
  }, [filtered]);

  return (
    <div className="app-container">
      <header className="app-header">
        <div><span className="status-dot" /><span className="status-label">DCMA Blue UAS Cleared List</span></div>
        <h1>Blue UAS Platform Explorer</h1>
        <p className="subtitle">
          Specifications for {DRONES.length} DoD-cleared drone platforms. NDAA-compliant, cyber-secure systems.
        </p>
      </header>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>
          Platform Directory
        </button>
        <button className={`tab-btn ${tab === 'planner' ? 'active' : ''}`} onClick={() => setTab('planner')}>
          Mission Planner
        </button>
        <button className={`tab-btn ${tab === 'graphics' ? 'active' : ''}`} onClick={() => setTab('graphics')}>
          Hot-Weather Performance
        </button>
      </div>

      {tab === 'list' && (
        <>
          <div className="stats-row">
            {[
              { l: 'Platforms', v: stats.total },
              { l: 'Manufacturers', v: stats.mfrs },
              { l: 'Avg Endurance', v: formatTime(stats.avgFlight) },
              { l: 'Max Endurance', v: formatTime(stats.maxFlight) },
            ].map((s, i) => (
              <div key={i} className="stat-card">
                <div className="stat-label">{s.l}</div>
                <div className="stat-value">{s.v}</div>
              </div>
            ))}
          </div>

          <div className="controls">
            <div className="search-wrap">
              <span className="icon">⌕</span>
              <input className="search-input" type="text" placeholder="Search platforms, manufacturers, types..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="filter-select" value={sortKey} onChange={e => setSortKey(e.target.value)}>
              <option value="flight_desc">Flight Time ↓</option>
              <option value="flight_asc">Flight Time ↑</option>
              <option value="speed_desc">Speed ↓</option>
              <option value="speed_asc">Speed ↑</option>
              <option value="weight_asc">Weight ↑</option>
              <option value="weight_desc">Weight ↓</option>
              <option value="range_desc">Range ↓</option>
              <option value="payload_desc">Payload ↓</option>
              <option value="model_asc">Name A-Z</option>
            </select>
            <select className="filter-select" value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
              <option value="All">All Groups</option>
              <option value="1">Group 1</option>
              <option value="2">Group 2</option>
              <option value="3">Group 3</option>
            </select>
            <select className="filter-select" value={filterMission} onChange={e => setFilterMission(e.target.value)}>
              <option value="All">All Missions</option>
              {MISSIONS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="results-count">{filtered.length} platform{filtered.length !== 1 ? 's' : ''} found</div>

          <div className="drone-list">
            {filtered.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                No platforms match current filters
              </div>
            ) : filtered.map((d, i) => (
              <DroneCard key={d.id} drone={d} index={i}
                isExpanded={expandedId === d.id}
                onToggle={() => setExpandedId(expandedId === d.id ? null : d.id)} />
            ))}
          </div>
        </>
      )}

      {tab === 'graphics' && <PerformanceTab />}

      {tab === 'planner' && <MissionPlannerTab />}

      <footer className="app-footer">
        Blue UAS Cleared List — DCMA / Defense Innovation Unit<br />
        Specifications sourced from manufacturer data sheets and official DoD publications<br />
        Hot-weather estimates based on published LiPo degradation research and manufacturer operating temp ratings<br />
        All platforms NDAA-compliant and validated as cyber-secure
      </footer>
    </div>
  );
}
