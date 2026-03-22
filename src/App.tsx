import { useState, useMemo } from 'react';
import { DRONES, formatTime, type Drone } from './data';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, CartesianGrid, Cell, ZAxis,
  type BarRectangleItem, type ScatterPointItem,
} from 'recharts';
import ComponentPhysicsTab from './ComponentPhysics';
import MaterialMatrixTab from './MaterialMatrix';

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

interface ChartTooltipPayloadEntry {
  payload: Drone & { name?: string; x?: number; y?: number; z?: number };
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipPayloadEntry[];
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
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

function PerformanceTab() {
  const [selectedDrone, setSelectedDrone] = useState<Drone | null>(null);
  const [activeChart, setActiveChart] = useState<'endurance' | 'range' | 'scatter'>('endurance');
  const nonTethered = DRONES.filter(d => !d.tethered);

  const enduranceData = useMemo(() =>
    [...nonTethered].sort((a, b) => b.flight_time_min - a.flight_time_min).slice(0, 25)
      .map(d => ({ ...d, name: d.model.length > 16 ? d.model.slice(0, 14) + '…' : d.model })), []);

  const rangeData = useMemo(() =>
    [...nonTethered].filter(d => d.range_mi > 5).sort((a, b) => b.range_mi - a.range_mi).slice(0, 20)
      .map(d => ({ ...d, name: d.model.length > 16 ? d.model.slice(0, 14) + '…' : d.model })), []);

  const scatterData = useMemo(() =>
    nonTethered.filter(d => d.hot_speed_mph > 0).map(d => ({
      ...d, x: d.hot_speed_mph, y: Math.min(d.hot_endurance_min, 500), z: d.weight_lbs,
    })), []);

  const gColors: Record<number, string> = { 1: '#0d9f6e', 2: '#1a6bff', 3: '#c47d0a' };

  function handleBarClick(data: BarRectangleItem) {
    const payload = data?.payload as Drone | undefined;
    if (payload?.id) { const drone = DRONES.find(d => d.id === payload.id); if (drone) setSelectedDrone(drone); }
  }

  return (
    <div className="graphics-section">
      <h2>Hot-Weather Performance Analysis</h2>
      <p className="section-desc">Estimated performance above 45°C (113°F). LiPo: 15-20% endurance loss. Hybrid/fuel: 5-10%. Click any data point for specs.</p>
      {selectedDrone && (
        <div className="drone-popup">
          <div className="popup-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <GroupBadge group={selectedDrone.group} />
                <span style={{ fontSize: 18, fontWeight: 700 }}>{selectedDrone.model}</span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}>{selectedDrone.manufacturer}</span>
              </div>
            </div>
            <button className="popup-close" onClick={() => setSelectedDrone(null)}>✕ Close</button>
          </div>
          <div className="spec-grid">
            {[
              { l: 'Standard Endurance', v: formatTime(selectedDrone.flight_time_min) },
              { l: 'Hot Endurance (>45°C)', v: formatTime(selectedDrone.hot_endurance_min), a: true },
              { l: 'Endurance Loss', v: selectedDrone.tethered ? '0%' : `-${Math.round((1 - selectedDrone.hot_endurance_min / selectedDrone.flight_time_min) * 100)}%`, r: true },
              { l: 'Standard Range', v: selectedDrone.range_mi > 0 ? `${selectedDrone.range_mi} mi` : 'Tethered' },
              { l: 'Hot Range', v: selectedDrone.hot_range_mi > 0 ? `${selectedDrone.hot_range_mi} mi` : 'Tethered', a: true },
              { l: 'Hot Speed', v: selectedDrone.hot_speed_mph > 0 ? `${selectedDrone.hot_speed_mph} mph` : 'N/A', a: true },
              { l: 'Max Temp Rating', v: `${selectedDrone.operating_temp_max_c}°C` },
              { l: 'Power Source', v: selectedDrone.power_source },
            ].map((s, i) => (
              <div key={i} className="spec-item">
                <div className="spec-label">{s.l}</div>
                <div className={`spec-value ${s.r ? 'red' : s.a ? 'accent' : ''}`} style={s.r ? { color: 'var(--red)' } : undefined}>{s.v}</div>
              </div>
            ))}
          </div>
          <p className="drone-desc">{selectedDrone.desc}</p>
        </div>
      )}
      <div className="tabs" style={{ maxWidth: 460, marginBottom: 16 }}>
        {([['endurance', 'Endurance'], ['range', 'Range'], ['scatter', 'Speed vs Endurance']] as const).map(([key, label]) => (
          <button key={key} className={`tab-btn ${activeChart === key ? 'active' : ''}`} onClick={() => setActiveChart(key)}>{label}</button>
        ))}
      </div>
      {activeChart === 'endurance' && (
        <div className="chart-card">
          <h3>Endurance: Standard vs &gt;45°C (Top 25)</h3>
          <p className="chart-subtitle">Click any bar for full specs</p>
          <ResponsiveContainer width="100%" height={520}>
            <BarChart data={enduranceData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#8994a6' }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#5a6578' }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="flight_time_min" name="Standard" fill="#1a6bff" radius={[0, 3, 3, 0]} opacity={0.35} cursor="pointer" onClick={handleBarClick} />
              <Bar dataKey="hot_endurance_min" name=">45°C" fill="#d6336c" radius={[0, 3, 3, 0]} cursor="pointer" onClick={handleBarClick} />
            </BarChart>
          </ResponsiveContainer>
          <div className="legend-row">
            <div className="legend-item"><div className="legend-dot" style={{ background: '#1a6bff', opacity: 0.35 }} />Standard</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#d6336c' }} />&gt;45°C</div>
          </div>
        </div>
      )}
      {activeChart === 'range' && (
        <div className="chart-card">
          <h3>Range: Standard vs &gt;45°C (Platforms &gt;5 mi)</h3>
          <p className="chart-subtitle">Click any bar for full specs</p>
          <ResponsiveContainer width="100%" height={460}>
            <BarChart data={rangeData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#8994a6' }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#5a6578' }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="range_mi" name="Standard" fill="#0d9f6e" radius={[0, 3, 3, 0]} opacity={0.35} cursor="pointer" onClick={handleBarClick} />
              <Bar dataKey="hot_range_mi" name=">45°C" fill="#c47d0a" radius={[0, 3, 3, 0]} cursor="pointer" onClick={handleBarClick} />
            </BarChart>
          </ResponsiveContainer>
          <div className="legend-row">
            <div className="legend-item"><div className="legend-dot" style={{ background: '#0d9f6e', opacity: 0.35 }} />Standard</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#c47d0a' }} />&gt;45°C</div>
          </div>
        </div>
      )}
      {activeChart === 'scatter' && (
        <div className="chart-card">
          <h3>Speed vs Endurance at &gt;45°C (by UAS Group)</h3>
          <p className="chart-subtitle">Bubble size = weight. Click for details.</p>
          <ResponsiveContainer width="100%" height={440}>
            <ScatterChart margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
              <XAxis type="number" dataKey="x" tick={{ fontSize: 11, fill: '#8994a6' }} label={{ value: 'Hot Speed (mph)', position: 'insideBottom', offset: -4, fontSize: 11, fill: '#8994a6' }} />
              <YAxis type="number" dataKey="y" tick={{ fontSize: 11, fill: '#8994a6' }} label={{ value: 'Hot Endurance (min)', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#8994a6' }} />
              <ZAxis type="number" dataKey="z" range={[40, 400]} />
              <Tooltip content={<ChartTooltip />} />
              <Scatter data={scatterData} cursor="pointer" onClick={(data: ScatterPointItem) => { const p = data?.payload as Drone | undefined; if (p?.id) { const dr = DRONES.find(dd => dd.id === p.id); if (dr) setSelectedDrone(dr); } }}>
                {scatterData.map((d, i) => (<Cell key={i} fill={gColors[d.group] || '#8994a6'} fillOpacity={0.7} stroke={gColors[d.group]} strokeWidth={1} />))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="legend-row">
            {[[1, 'Group 1'], [2, 'Group 2'], [3, 'Group 3']].map(([g, l]) => (
              <div key={g} className="legend-item"><div className="legend-dot" style={{ background: gColors[g as number] }} />{l as string}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<'list' | 'graphics' | 'physics' | 'materials'>('list');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('flight_desc');
  const [filterMission, setFilterMission] = useState('All');
  const [filterGroup, setFilterGroup] = useState('All');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const list = DRONES.filter(d => {
      const q = search.toLowerCase();
      const ms = !q || d.manufacturer.toLowerCase().includes(q) || d.model.toLowerCase().includes(q) || d.type.toLowerCase().includes(q) || d.mission.toLowerCase().includes(q);
      const mm = filterMission === 'All' || d.mission === filterMission;
      const mg = filterGroup === 'All' || d.group === Number(filterGroup);
      return ms && mm && mg;
    });
    const [key, dir] = sortKey.split('_');
    const mult = dir === 'desc' ? -1 : 1;
    const fieldMap: Record<string, keyof Drone> = { flight: 'flight_time_min', speed: 'max_speed_mph', weight: 'weight_lbs', range: 'range_mi', payload: 'payload_lbs', model: 'model' };
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
        <p className="subtitle">Specifications for {DRONES.length} DoD-cleared drone platforms. NDAA-compliant, cyber-secure systems.</p>
      </header>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>Platform Directory</button>
        <button className={`tab-btn ${tab === 'graphics' ? 'active' : ''}`} onClick={() => setTab('graphics')}>Hot-Weather Performance</button>
        <button className={`tab-btn ${tab === 'physics' ? 'active' : ''}`} onClick={() => setTab('physics')}>Component Physics</button>
        <button className={`tab-btn ${tab === 'materials' ? 'active' : ''}`} onClick={() => setTab('materials')}>Filament Matrix</button>
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
              <div key={i} className="stat-card"><div className="stat-label">{s.l}</div><div className="stat-value">{s.v}</div></div>
            ))}
          </div>
          <div className="controls">
            <div className="search-wrap">
              <span className="icon">⌕</span>
              <input className="search-input" type="text" placeholder="Search platforms, manufacturers, types..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="filter-select" value={sortKey} onChange={e => setSortKey(e.target.value)}>
              <option value="flight_desc">Flight Time ↓</option><option value="flight_asc">Flight Time ↑</option>
              <option value="speed_desc">Speed ↓</option><option value="weight_asc">Weight ↑</option>
              <option value="range_desc">Range ↓</option><option value="payload_desc">Payload ↓</option>
              <option value="model_asc">Name A-Z</option>
            </select>
            <select className="filter-select" value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
              <option value="All">All Groups</option><option value="1">Group 1</option><option value="2">Group 2</option><option value="3">Group 3</option>
            </select>
            <select className="filter-select" value={filterMission} onChange={e => setFilterMission(e.target.value)}>
              <option value="All">All Missions</option>
              {MISSIONS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="results-count">{filtered.length} platform{filtered.length !== 1 ? 's' : ''} found</div>
          <div className="drone-list">
            {filtered.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-tertiary)' }}>No platforms match</div>
            ) : filtered.map((d, i) => (
              <DroneCard key={d.id} drone={d} index={i} isExpanded={expandedId === d.id} onToggle={() => setExpandedId(expandedId === d.id ? null : d.id)} />
            ))}
          </div>
        </>
      )}

      {tab === 'graphics' && <PerformanceTab />}
      {tab === 'physics' && <ComponentPhysicsTab />}
      {tab === 'materials' && <MaterialMatrixTab />}

      <footer className="app-footer">
        Blue UAS Cleared List — DCMA / Defense Innovation Unit<br />
        Specs from manufacturer data sheets and DoD publications<br />
        Hot-weather estimates based on LiPo degradation research and manufacturer temp ratings
      </footer>
    </div>
  );
}
