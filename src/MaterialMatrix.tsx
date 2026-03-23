import { useState } from 'react';

/* ════════════════════════════════════════════
 * 3D PRINTING FILAMENT COMPARISON MATRIX
 * Source: Learn By Layers / ThreeDotZero Studios
 * Filament Comparison Chart V1.1 May 2018
 *
 * Data corrected against original PDF gauge readings.
 * ════════════════════════════════════════════ */

interface Filament {
  name: string;
  subtitle: string;
  printTempLow: number;
  printTempHigh: number;
  bedTempLow: number | null;
  bedTempHigh: number | null;
  strength: number;
  flexibility: number;
  durability: number;
  difficulty: number;
  shrinkage: number;
  soluble: string;
  foodSafe: boolean | null;
  blueTape: boolean | null;
  glueStick: boolean | null;
  typicalUses: string;
  color: string;
}

const FILAMENTS: Filament[] = [
  { name: 'ABS', subtitle: 'Acrylonitrile Butadiene Styrene', printTempLow: 210, printTempHigh: 250, bedTempLow: 50, bedTempHigh: 100, strength: 4, flexibility: 3, durability: 4, difficulty: 3, shrinkage: 4, soluble: 'Acetone', foodSafe: false, blueTape: true, glueStick: true, typicalUses: 'Functional Parts', color: '#e74c3c' },
  { name: 'ASA', subtitle: 'Acrylonitrile Styrene Acrylate', printTempLow: 240, printTempHigh: 260, bedTempLow: 100, bedTempHigh: 120, strength: 4, flexibility: 3, durability: 5, difficulty: 3, shrinkage: 4, soluble: 'Acetone', foodSafe: false, blueTape: true, glueStick: true, typicalUses: 'Outdoor Use', color: '#e67e22' },
  { name: 'Carbon Fiber', subtitle: 'Carbon Fiber and PLA blend', printTempLow: 195, printTempHigh: 220, bedTempLow: null, bedTempHigh: null, strength: 4, flexibility: 1, durability: 4, difficulty: 2, shrinkage: 2, soluble: 'No', foodSafe: false, blueTape: false, glueStick: false, typicalUses: 'Functional Parts', color: '#1abc9c' },
  { name: 'Cleaning', subtitle: 'Cleaning Filament', printTempLow: 150, printTempHigh: 260, bedTempLow: null, bedTempHigh: null, strength: 0, flexibility: 0, durability: 0, difficulty: 0, shrinkage: 0, soluble: '—', foodSafe: null, blueTape: null, glueStick: null, typicalUses: 'Nozzle Cleaning / Unclogging', color: '#95a5a6' },
  { name: 'Color Changing', subtitle: 'PLA or ABS with color changing properties', printTempLow: 210, printTempHigh: 220, bedTempLow: null, bedTempHigh: null, strength: 2, flexibility: 2, durability: 2, difficulty: 1, shrinkage: 2, soluble: 'No', foodSafe: false, blueTape: true, glueStick: true, typicalUses: 'Educational, Modelling', color: '#e91e8c' },
  { name: 'Conductive', subtitle: 'Conductive PLA or ABS', printTempLow: 215, printTempHigh: 230, bedTempLow: null, bedTempHigh: null, strength: 2, flexibility: 2, durability: 2, difficulty: 2, shrinkage: 2, soluble: 'No', foodSafe: false, blueTape: true, glueStick: true, typicalUses: 'Electronics', color: '#5ba3cf' },
  { name: 'Flexible, TPE, TPU', subtitle: 'Thermoplastic Urethane / Polyurethane', printTempLow: 205, printTempHigh: 250, bedTempLow: null, bedTempHigh: null, strength: 2, flexibility: 5, durability: 3, difficulty: 3, shrinkage: 2, soluble: 'No', foodSafe: false, blueTape: true, glueStick: false, typicalUses: 'Elastic Parts, Wearables', color: '#3498db' },
  { name: 'FPE', subtitle: 'Flexible Polyester', printTempLow: 205, printTempHigh: 250, bedTempLow: 75, bedTempHigh: 75, strength: 2, flexibility: 4, durability: 3, difficulty: 3, shrinkage: 2, soluble: 'No', foodSafe: true, blueTape: true, glueStick: false, typicalUses: 'Flexible Parts', color: '#5dade2' },
  { name: 'Glow-In-The-Dark', subtitle: 'Glow in the dark PLA or ABS', printTempLow: 210, printTempHigh: 230, bedTempLow: null, bedTempHigh: null, strength: 2, flexibility: 2, durability: 2, difficulty: 1, shrinkage: 2, soluble: 'No', foodSafe: false, blueTape: true, glueStick: true, typicalUses: 'Educational, Modelling', color: '#58d68d' },
  { name: 'HIPS', subtitle: 'High Impact Polystyrene', printTempLow: 210, printTempHigh: 250, bedTempLow: 50, bedTempHigh: 100, strength: 3, flexibility: 2, durability: 3, difficulty: 2, shrinkage: 3, soluble: 'Solvent', foodSafe: false, blueTape: true, glueStick: true, typicalUses: 'Support Structures', color: '#27ae60' },
  { name: 'Lignin (bioFila)', subtitle: 'Lignin and PLA plus additives', printTempLow: 190, printTempHigh: 225, bedTempLow: 55, bedTempHigh: 55, strength: 2, flexibility: 2, durability: 2, difficulty: 2, shrinkage: 2, soluble: 'No', foodSafe: true, blueTape: true, glueStick: true, typicalUses: 'All Purpose', color: '#a4b52c' },
  { name: 'Magnetic', subtitle: 'PLA with powdered iron', printTempLow: 195, printTempHigh: 220, bedTempLow: null, bedTempHigh: null, strength: 2, flexibility: 1, durability: 2, difficulty: 2, shrinkage: 2, soluble: 'No', foodSafe: false, blueTape: true, glueStick: true, typicalUses: 'Educational, Experimental', color: '#8e44ad' },
  { name: 'Metal PLA / ABS', subtitle: 'Metal Powder and PLA or ABS blend', printTempLow: 195, printTempHigh: 220, bedTempLow: null, bedTempHigh: null, strength: 3, flexibility: 1, durability: 3, difficulty: 3, shrinkage: 2, soluble: 'No', foodSafe: false, blueTape: false, glueStick: false, typicalUses: 'Jewellery', color: '#a3b0b2' },
  { name: 'nGen', subtitle: 'Similar to PETG', printTempLow: 210, printTempHigh: 240, bedTempLow: 60, bedTempHigh: 60, strength: 3, flexibility: 2, durability: 3, difficulty: 2, shrinkage: 2, soluble: 'No', foodSafe: true, blueTape: true, glueStick: true, typicalUses: 'All Purpose', color: '#16a085' },
  { name: 'Nylon', subtitle: 'Polyamide', printTempLow: 220, printTempHigh: 260, bedTempLow: 50, bedTempHigh: 100, strength: 4, flexibility: 3, durability: 4, difficulty: 4, shrinkage: 4, soluble: 'No', foodSafe: true, blueTape: true, glueStick: false, typicalUses: 'All Purpose', color: '#6b8cff' },
  { name: 'PC', subtitle: 'Polycarbonate', printTempLow: 270, printTempHigh: 310, bedTempLow: 90, bedTempHigh: 105, strength: 5, flexibility: 2, durability: 5, difficulty: 4, shrinkage: 3, soluble: 'Acetone', foodSafe: false, blueTape: true, glueStick: false, typicalUses: 'Functional Parts', color: '#c0392b' },
  { name: 'PC/ABS', subtitle: 'Polycarbonate ABS', printTempLow: 260, printTempHigh: 280, bedTempLow: 120, bedTempHigh: 120, strength: 4, flexibility: 3, durability: 4, difficulty: 4, shrinkage: 3, soluble: 'No', foodSafe: false, blueTape: true, glueStick: false, typicalUses: 'Functional Parts', color: '#a93226' },
  { name: 'PET (CPE)', subtitle: 'Polyethylene Terephthalate', printTempLow: 220, printTempHigh: 250, bedTempLow: null, bedTempHigh: null, strength: 3, flexibility: 2, durability: 3, difficulty: 2, shrinkage: 2, soluble: 'No', foodSafe: true, blueTape: true, glueStick: true, typicalUses: 'All Purpose', color: '#e67e22' },
  { name: 'PETG (XT, N-Vent)', subtitle: 'Poly-Ethylene Terephthalate Glycol', printTempLow: 220, printTempHigh: 235, bedTempLow: null, bedTempHigh: null, strength: 3, flexibility: 3, durability: 4, difficulty: 2, shrinkage: 2, soluble: 'No', foodSafe: true, blueTape: true, glueStick: true, typicalUses: 'All Purpose', color: '#f39c12' },
  { name: 'PETT (T-Glase)', subtitle: 'PolyEthylene coTrimethylene Terephthalate', printTempLow: 235, printTempHigh: 240, bedTempLow: null, bedTempHigh: null, strength: 3, flexibility: 3, durability: 3, difficulty: 3, shrinkage: 2, soluble: 'No', foodSafe: true, blueTape: true, glueStick: true, typicalUses: 'Functional Parts', color: '#d35400' },
  { name: 'PLA', subtitle: 'Polylactic Acid', printTempLow: 180, printTempHigh: 230, bedTempLow: null, bedTempHigh: null, strength: 2, flexibility: 1, durability: 2, difficulty: 1, shrinkage: 2, soluble: 'No', foodSafe: true, blueTape: true, glueStick: true, typicalUses: 'Consumer Products', color: '#82c91e' },
  { name: 'PMMA, Acrylic', subtitle: 'PolyMethyl Methacrylate', printTempLow: 235, printTempHigh: 250, bedTempLow: 100, bedTempHigh: 120, strength: 3, flexibility: 2, durability: 3, difficulty: 3, shrinkage: 2, soluble: 'Acetone', foodSafe: false, blueTape: true, glueStick: true, typicalUses: 'Light diffusers, Modelling', color: '#e84393' },
  { name: 'POM, Acetal', subtitle: 'Polyoxymethylene', printTempLow: 210, printTempHigh: 225, bedTempLow: 130, bedTempHigh: 130, strength: 4, flexibility: 3, durability: 4, difficulty: 4, shrinkage: 3, soluble: 'Chemical', foodSafe: false, blueTape: false, glueStick: false, typicalUses: 'Functional Parts', color: '#d63031' },
  { name: 'PORO-LAY', subtitle: 'Rubber-elastomeric polymer with PVA', printTempLow: 220, printTempHigh: 235, bedTempLow: null, bedTempHigh: null, strength: 1, flexibility: 4, durability: 2, difficulty: 3, shrinkage: 2, soluble: 'Water', foodSafe: true, blueTape: true, glueStick: false, typicalUses: 'Experimental', color: '#74b9ff' },
  { name: 'PP', subtitle: 'Polypropylene', printTempLow: 210, printTempHigh: 230, bedTempLow: 120, bedTempHigh: 150, strength: 2, flexibility: 4, durability: 3, difficulty: 4, shrinkage: 4, soluble: 'No', foodSafe: true, blueTape: false, glueStick: false, typicalUses: 'Flexible Components', color: '#0984e3' },
  { name: 'PVA', subtitle: 'Polyvinyl Alcohol', printTempLow: 180, printTempHigh: 230, bedTempLow: null, bedTempHigh: null, strength: 2, flexibility: 2, durability: 1, difficulty: 2, shrinkage: 2, soluble: 'Water', foodSafe: true, blueTape: true, glueStick: false, typicalUses: 'Support Structures', color: '#00b894' },
  { name: 'Sandstone (Laybrick)', subtitle: 'Co-polyester and chalk powder', printTempLow: 165, printTempHigh: 210, bedTempLow: null, bedTempHigh: null, strength: 2, flexibility: 1, durability: 2, difficulty: 2, shrinkage: 1, soluble: 'No', foodSafe: false, blueTape: false, glueStick: false, typicalUses: 'Architectural Modelling', color: '#b8a07e' },
  { name: 'TPC', subtitle: 'Thermoplastic Copolyester', printTempLow: 210, printTempHigh: 210, bedTempLow: 60, bedTempHigh: 100, strength: 2, flexibility: 4, durability: 3, difficulty: 2, shrinkage: 2, soluble: 'No', foodSafe: false, blueTape: false, glueStick: false, typicalUses: 'Elastic Parts, Outdoor Use', color: '#00cec9' },
  { name: 'Wax (MOLDLAY)', subtitle: 'Wax-like properties', printTempLow: 170, printTempHigh: 180, bedTempLow: null, bedTempHigh: null, strength: 1, flexibility: 2, durability: 1, difficulty: 3, shrinkage: 2, soluble: 'No', foodSafe: false, blueTape: false, glueStick: false, typicalUses: 'Lost Wax Casting', color: '#9ba8ad' },
  { name: 'Wood (Laywood)', subtitle: 'Wood PLA Blend', printTempLow: 195, printTempHigh: 220, bedTempLow: null, bedTempHigh: null, strength: 2, flexibility: 2, durability: 2, difficulty: 2, shrinkage: 2, soluble: 'No', foodSafe: false, blueTape: true, glueStick: true, typicalUses: 'All Purpose (Natural Finish)', color: '#8d6e46' },
];

/* ── Visual Components ── */

const PRINT_MIN = 150;
const PRINT_MAX = 310;
const BED_MIN = 50;
const BED_MAX = 150;

function TempGauge({ low, high, scaleMin, scaleMax, color }: {
  low: number; high: number; scaleMin: number; scaleMax: number; color: string;
}) {
  const range = scaleMax - scaleMin;
  const leftPct = ((low - scaleMin) / range) * 100;
  const widthPct = ((high - low) / range) * 100;
  const label = low === high ? `${low}` : `${low}–${high}`;
  return (
    <div className="fm-gauge">
      <div className="fm-gauge-track">
        <div className="fm-gauge-fill" style={{
          left: `${leftPct}%`,
          width: `${Math.max(widthPct, 2)}%`,
          background: color,
        }} />
      </div>
      <div className="fm-gauge-label">{label}°C</div>
    </div>
  );
}

function Cubes({ count, max = 5, color }: { count: number; max?: number; color: string }) {
  if (count === 0) return <span className="fm-na">—</span>;
  return (
    <span className="fm-cubes">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className="fm-cube" style={{
          background: i < count ? color : 'transparent',
          borderColor: i < count ? color : 'var(--border)',
          opacity: i < count ? 1 : 0.25,
        }} />
      ))}
    </span>
  );
}

function AdhesionIcon({ value }: { value: boolean | null }) {
  if (value === null) return <span className="fm-na">—</span>;
  return (
    <span className={`fm-adhesion ${value ? 'yes' : 'no'}`}>
      {value ? '✓' : '✗'}
    </span>
  );
}

/* ── Main Component ── */

export default function MaterialMatrixTab() {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function handleSort(col: string) {
    if (sortCol === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  const filtered = FILAMENTS
    .filter(f => {
      if (!search) return true;
      const q = search.toLowerCase();
      return f.name.toLowerCase().includes(q) ||
        f.subtitle.toLowerCase().includes(q) ||
        f.typicalUses.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (!sortCol) return 0;
      const m = sortDir === 'desc' ? -1 : 1;
      const av = a[sortCol as keyof Filament];
      const bv = b[sortCol as keyof Filament];
      if (typeof av === 'number' && typeof bv === 'number') return m * (av - bv);
      if (typeof av === 'string' && typeof bv === 'string') return m * av.localeCompare(bv);
      return 0;
    });

  const sortArrow = (col: string): string => {
    if (sortCol !== col) return ' ↕';
    return sortDir === 'desc' ? ' ↓' : ' ↑';
  };

  return (
    <div className="fm-tab">
      <h2>3D Printing Filament Comparison</h2>
      <p className="section-desc">
        Comprehensive material property matrix for 30 FDM/FFF filaments.
        Temperature ranges shown as gauge bars. Ratings use a 1–5 cube scale.
        Click any column header to sort.
      </p>

      <div className="fm-controls">
        <div className="search-wrap" style={{ maxWidth: 360 }}>
          <span className="icon">⌕</span>
          <input className="search-input" type="text"
            placeholder="Search materials, uses..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span className="results-count" style={{ padding: 0 }}>
          {filtered.length} material{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="fm-legend-bar">
        <div className="fm-legend-group">
          <span className="fm-legend-title">Rating Scale</span>
          <div className="fm-legend-cubes">
            {[1, 2, 3, 4, 5].map(n => (
              <div key={n} className="fm-legend-cube-item">
                <Cubes count={n} color="var(--accent)" />
                {(n === 1 || n === 3 || n === 5) && (
                  <span>{n === 1 ? 'Low' : n === 3 ? 'Med' : 'High'}</span>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="fm-legend-group">
          <span className="fm-legend-title">Adhesion</span>
          <div className="fm-legend-adhesion">
            <span><AdhesionIcon value={true} /> Works</span>
            <span><AdhesionIcon value={false} /> Not rec.</span>
            <span><span className="fm-na">—</span> N/A</span>
          </div>
        </div>
      </div>

      <div className="fm-scroll">
        <table className="fm-table">
          <thead>
            <tr>
              <th className="fm-th fm-th-material">Material</th>
              <th className="fm-th fm-th-gauge">
                <div>Print Temp</div>
                <div className="fm-th-scale">{PRINT_MIN}–{PRINT_MAX}°C</div>
              </th>
              <th className="fm-th fm-th-gauge">
                <div>Bed Temp</div>
                <div className="fm-th-scale">{BED_MIN}–{BED_MAX}°C</div>
              </th>
              <th className="fm-th fm-th-rating sortable" onClick={() => handleSort('strength')}>STR{sortArrow('strength')}</th>
              <th className="fm-th fm-th-rating sortable" onClick={() => handleSort('flexibility')}>FLX{sortArrow('flexibility')}</th>
              <th className="fm-th fm-th-rating sortable" onClick={() => handleSort('durability')}>DUR{sortArrow('durability')}</th>
              <th className="fm-th fm-th-rating sortable" onClick={() => handleSort('difficulty')}>DIF{sortArrow('difficulty')}</th>
              <th className="fm-th fm-th-rating sortable" onClick={() => handleSort('shrinkage')}>SHR{sortArrow('shrinkage')}</th>
              <th className="fm-th fm-th-narrow">Soluble</th>
              <th className="fm-th fm-th-narrow">Food Safe</th>
              <th className="fm-th fm-th-icon">Tape</th>
              <th className="fm-th fm-th-icon">Glue</th>
              <th className="fm-th fm-th-uses">Typical Uses</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f, i) => (
              <tr key={i} className="fm-row" style={{ animationDelay: `${i * 0.018}s` }}>
                <td className="fm-td-material">
                  <div className="fm-color-bar" style={{ background: f.color }} />
                  <div className="fm-material-info">
                    <div className="fm-material-name" style={{ color: f.color }}>{f.name}</div>
                    <div className="fm-material-sub">{f.subtitle}</div>
                  </div>
                </td>
                <td className="fm-td-gauge">
                  <TempGauge low={f.printTempLow} high={f.printTempHigh}
                    scaleMin={PRINT_MIN} scaleMax={PRINT_MAX} color={f.color} />
                </td>
                <td className="fm-td-gauge">
                  {f.bedTempLow !== null && f.bedTempHigh !== null ? (
                    <TempGauge low={f.bedTempLow} high={f.bedTempHigh}
                      scaleMin={BED_MIN} scaleMax={BED_MAX} color={f.color} />
                  ) : (
                    <span className="fm-na">N/A</span>
                  )}
                </td>
                <td className="fm-td-cubes"><Cubes count={f.strength} color={f.color} /></td>
                <td className="fm-td-cubes"><Cubes count={f.flexibility} color={f.color} /></td>
                <td className="fm-td-cubes"><Cubes count={f.durability} color={f.color} /></td>
                <td className="fm-td-cubes"><Cubes count={f.difficulty} color={f.color} /></td>
                <td className="fm-td-cubes"><Cubes count={f.shrinkage} color={f.color} /></td>
                <td className="fm-td-center">
                  {f.soluble === '—' ? <span className="fm-na">—</span> : (
                    <span className={`fm-soluble ${f.soluble === 'No' ? 'none' : 'yes'}`}>
                      {f.soluble}
                    </span>
                  )}
                </td>
                <td className="fm-td-center">
                  {f.foodSafe === null ? <span className="fm-na">—</span> : (
                    <span className={`fm-foodsafe ${f.foodSafe ? 'yes' : 'no'}`}>
                      {f.foodSafe ? 'Yes' : 'No'}
                    </span>
                  )}
                </td>
                <td className="fm-td-center"><AdhesionIcon value={f.blueTape} /></td>
                <td className="fm-td-center"><AdhesionIcon value={f.glueStick} /></td>
                <td className="fm-td-uses">{f.typicalUses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="fm-source">
        Source: Learn By Layers / ThreeDotZero Studios — 3D Printing Filament Comparison V1.1, May 2018.
        Temperature ranges in °C. Ratings are generalized — always verify with your specific filament brand.
        *Food safety depends on nozzle material and post-processing.
      </p>
    </div>
  );
}
