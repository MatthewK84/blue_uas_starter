import { useState } from 'react';

/* ════════════════════════════════════════════
 * 3D PRINTING MATERIAL COMPARISON MATRIX
 * Based on "Learn By Layers / ThreeDotZero Studios"
 * Filament Comparison Chart V1.1 May 2018
 * ════════════════════════════════════════════ */

interface Filament {
  name: string;
  subtitle: string;
  printTemp: string;
  bedTemp: string;
  strength: number;
  flexibility: number;
  durability: number;
  difficulty: number;
  shrinkage: number;
  soluble: string;
  foodSafe: string;
  blueTape: boolean | null;
  glueStick: boolean | null;
  typicalUses: string;
  color: string;
}

const FILAMENTS: Filament[] = [
  { name: 'ABS', subtitle: 'Acrylonitrile Butadiene Styrene', printTemp: '220–250', bedTemp: '95–110', strength: 4, flexibility: 3, durability: 4, difficulty: 3, shrinkage: 4, soluble: 'Acetone', foodSafe: 'No', blueTape: true, glueStick: true, typicalUses: 'Functional Parts', color: '#e74c3c' },
  { name: 'ASA', subtitle: 'Acrylonitrile Styrene Acrylate', printTemp: '235–255', bedTemp: '95–110', strength: 4, flexibility: 3, durability: 5, difficulty: 3, shrinkage: 4, soluble: 'Acetone', foodSafe: 'No', blueTape: true, glueStick: true, typicalUses: 'Outdoor Use', color: '#e67e22' },
  { name: 'Carbon Fiber', subtitle: 'Carbon Fiber and PLA blend', printTemp: '195–220', bedTemp: '45–70', strength: 4, flexibility: 1, durability: 4, difficulty: 2, shrinkage: 2, soluble: 'No', foodSafe: 'No', blueTape: false, glueStick: false, typicalUses: 'Functional Parts', color: '#1abc9c' },
  { name: 'Cleaning', subtitle: 'Cleaning Filament', printTemp: '245–265', bedTemp: '—', strength: 0, flexibility: 0, durability: 0, difficulty: 0, shrinkage: 0, soluble: '—', foodSafe: '—', blueTape: null, glueStick: null, typicalUses: 'Nozzle Cleaning / Unclogging', color: '#95a5a6' },
  { name: 'Color Changing', subtitle: 'PLA or ABS with color changing properties', printTemp: '210–230', bedTemp: 'N/A', strength: 2, flexibility: 2, durability: 2, difficulty: 1, shrinkage: 2, soluble: 'No', foodSafe: 'No', blueTape: true, glueStick: true, typicalUses: 'Educational, Modelling', color: '#e91e8c' },
  { name: 'Conductive', subtitle: 'Conductive PLA or ABS', printTemp: '225–250', bedTemp: '—', strength: 2, flexibility: 2, durability: 2, difficulty: 2, shrinkage: 2, soluble: 'No', foodSafe: 'No', blueTape: true, glueStick: true, typicalUses: 'Electronics', color: '#2c3e50' },
  { name: 'Flexible, TPE, TPU', subtitle: 'Thermoplastic Urethane / Polyurethane', printTemp: '225–245', bedTemp: '45–60', strength: 2, flexibility: 5, durability: 3, difficulty: 3, shrinkage: 2, soluble: 'No', foodSafe: 'No', blueTape: true, glueStick: false, typicalUses: 'Elastic Parts, Wearables', color: '#3498db' },
  { name: 'FPE', subtitle: 'Flexible Polyester', printTemp: '195–230', bedTemp: '—', strength: 2, flexibility: 4, durability: 3, difficulty: 3, shrinkage: 2, soluble: 'No', foodSafe: 'Yes', blueTape: true, glueStick: false, typicalUses: 'Flexible Parts', color: '#5dade2' },
  { name: 'Glow-In-The-Dark', subtitle: 'Glow in the dark PLA or ABS', printTemp: '195–230', bedTemp: 'N/A', strength: 2, flexibility: 2, durability: 2, difficulty: 1, shrinkage: 2, soluble: 'No', foodSafe: 'No', blueTape: true, glueStick: true, typicalUses: 'Educational, Modelling', color: '#58d68d' },
  { name: 'HIPS', subtitle: 'High Impact Polystyrene', printTemp: '220–250', bedTemp: '95–110', strength: 3, flexibility: 2, durability: 3, difficulty: 2, shrinkage: 3, soluble: 'Solvent', foodSafe: 'No', blueTape: true, glueStick: true, typicalUses: 'Support Structures', color: '#27ae60' },
  { name: 'Lignin (bioFila)', subtitle: 'Lignin and PLA plus additives', printTemp: '195–220', bedTemp: '—', strength: 2, flexibility: 2, durability: 2, difficulty: 2, shrinkage: 2, soluble: 'No', foodSafe: 'No', blueTape: true, glueStick: true, typicalUses: 'All Purpose', color: '#a4b52c' },
  { name: 'Magnetic', subtitle: 'PLA with powdered iron', printTemp: '195–220', bedTemp: '—', strength: 2, flexibility: 1, durability: 2, difficulty: 2, shrinkage: 2, soluble: 'No', foodSafe: 'No', blueTape: true, glueStick: true, typicalUses: 'Educational, Experimental', color: '#8e44ad' },
  { name: 'Metal PLA / ABS', subtitle: 'Metal Powder and PLA or ABS blend', printTemp: '195–220', bedTemp: '—', strength: 3, flexibility: 1, durability: 3, difficulty: 3, shrinkage: 2, soluble: 'No', foodSafe: 'No', blueTape: false, glueStick: false, typicalUses: 'Jewellery', color: '#7f8c8d' },
  { name: 'nGen', subtitle: 'Similar to PETG', printTemp: '220–240', bedTemp: '—', strength: 3, flexibility: 2, durability: 3, difficulty: 2, shrinkage: 2, soluble: 'No', foodSafe: 'Yes', blueTape: true, glueStick: true, typicalUses: 'All Purpose', color: '#16a085' },
  { name: 'Nylon', subtitle: 'Polyamide', printTemp: '240–270', bedTemp: '70–90', strength: 4, flexibility: 3, durability: 4, difficulty: 4, shrinkage: 4, soluble: 'No', foodSafe: 'Yes', blueTape: true, glueStick: false, typicalUses: 'All Purpose', color: '#2c3e80' },
  { name: 'PC', subtitle: 'Polycarbonate', printTemp: '270–310', bedTemp: '90–105', strength: 5, flexibility: 2, durability: 5, difficulty: 4, shrinkage: 3, soluble: 'Acetone', foodSafe: 'No', blueTape: true, glueStick: false, typicalUses: 'Functional Parts', color: '#c0392b' },
  { name: 'PC/ABS', subtitle: 'Polycarbonate ABS', printTemp: '240–270', bedTemp: '90–105', strength: 4, flexibility: 3, durability: 4, difficulty: 4, shrinkage: 3, soluble: 'No', foodSafe: 'No', blueTape: true, glueStick: false, typicalUses: 'Functional Parts', color: '#a93226' },
  { name: 'PET (CPE)', subtitle: 'Polyethylene Terephthalate', printTemp: '225–255', bedTemp: '—', strength: 3, flexibility: 2, durability: 3, difficulty: 2, shrinkage: 2, soluble: 'No', foodSafe: 'Yes', blueTape: true, glueStick: true, typicalUses: 'All Purpose', color: '#e67e22' },
  { name: 'PETG (XT, N-Vent)', subtitle: 'Poly-Ethylene Terephthalate Glycol', printTemp: '220–250', bedTemp: '—', strength: 3, flexibility: 3, durability: 4, difficulty: 2, shrinkage: 2, soluble: 'No', foodSafe: 'Yes', blueTape: true, glueStick: true, typicalUses: 'All Purpose', color: '#f39c12' },
  { name: 'PETT (T-Glase)', subtitle: 'PolyEthylene coTrimethylene Terephthalate', printTemp: '225–245', bedTemp: '—', strength: 3, flexibility: 3, durability: 3, difficulty: 3, shrinkage: 2, soluble: 'No', foodSafe: 'Yes', blueTape: true, glueStick: true, typicalUses: 'Functional Parts', color: '#d35400' },
  { name: 'PLA', subtitle: 'Polylactic Acid', printTemp: '190–220', bedTemp: '45–60', strength: 2, flexibility: 1, durability: 2, difficulty: 1, shrinkage: 2, soluble: 'No', foodSafe: 'No', blueTape: true, glueStick: true, typicalUses: 'Consumer Products', color: '#82c91e' },
  { name: 'PMMA, Acrylic', subtitle: 'PolyMethyl Methacrylate', printTemp: '235–255', bedTemp: '—', strength: 3, flexibility: 2, durability: 3, difficulty: 3, shrinkage: 2, soluble: 'Acetone', foodSafe: 'No', blueTape: true, glueStick: true, typicalUses: 'Light diffusers, Modelling', color: '#e84393' },
  { name: 'POM, Acetal', subtitle: 'Polyoxymethylene', printTemp: '215–235', bedTemp: '—', strength: 4, flexibility: 3, durability: 4, difficulty: 4, shrinkage: 3, soluble: 'Chemical', foodSafe: 'No', blueTape: false, glueStick: false, typicalUses: 'Functional Parts', color: '#d63031' },
  { name: 'PORO-LAY', subtitle: 'Rubber-elastomeric polymer with PVA', printTemp: '215–235', bedTemp: '—', strength: 1, flexibility: 4, durability: 2, difficulty: 3, shrinkage: 2, soluble: 'Water', foodSafe: 'Yes', blueTape: true, glueStick: false, typicalUses: 'Experimental', color: '#74b9ff' },
  { name: 'PP', subtitle: 'Polypropylene', printTemp: '215–230', bedTemp: '—', strength: 2, flexibility: 4, durability: 3, difficulty: 4, shrinkage: 4, soluble: 'No', foodSafe: 'Yes', blueTape: false, glueStick: false, typicalUses: 'Flexible Components', color: '#0984e3' },
  { name: 'PVA', subtitle: 'Polyvinyl Alcohol', printTemp: '185–210', bedTemp: '—', strength: 2, flexibility: 2, durability: 1, difficulty: 2, shrinkage: 2, soluble: 'Water', foodSafe: 'Yes', blueTape: true, glueStick: false, typicalUses: 'Support Structures', color: '#00b894' },
  { name: 'Sandstone (Laybrick)', subtitle: 'Co-polyester and chalk powder', printTemp: '165–210', bedTemp: '—', strength: 2, flexibility: 1, durability: 2, difficulty: 2, shrinkage: 1, soluble: 'No', foodSafe: 'No', blueTape: false, glueStick: false, typicalUses: 'Architectural Modelling', color: '#b8a07e' },
  { name: 'TPC', subtitle: 'Thermoplastic Copolyester', printTemp: '210–235', bedTemp: '—', strength: 2, flexibility: 4, durability: 3, difficulty: 2, shrinkage: 2, soluble: 'No', foodSafe: 'No', blueTape: false, glueStick: false, typicalUses: 'Elastic Parts, Outdoor Use', color: '#00cec9' },
  { name: 'Wax (MOLDLAY)', subtitle: 'Wax-like properties', printTemp: '170–200', bedTemp: '—', strength: 1, flexibility: 2, durability: 1, difficulty: 3, shrinkage: 2, soluble: 'No', foodSafe: 'No', blueTape: false, glueStick: false, typicalUses: 'Lost Wax Casting', color: '#636e72' },
  { name: 'Wood (Laywood)', subtitle: 'Wood PLA Blend', printTemp: '175–220', bedTemp: '—', strength: 2, flexibility: 2, durability: 2, difficulty: 2, shrinkage: 2, soluble: 'No', foodSafe: 'No', blueTape: true, glueStick: true, typicalUses: 'All Purpose (Natural Finish)', color: '#8d6e46' },
];

function Dots({ count, max = 5 }: { count: number; max?: number }) {
  if (count === 0) return <span className="matrix-na">—</span>;
  return (
    <span className="matrix-dots">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`matrix-dot ${i < count ? 'filled' : 'empty'}`} />
      ))}
    </span>
  );
}

function BoolCell({ value }: { value: boolean | null }) {
  if (value === null) return <span className="matrix-na">—</span>;
  return <span className={`matrix-bool ${value ? 'yes' : 'no'}`}>{value ? '●' : '○'}</span>;
}

export default function MaterialMatrixTab() {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function handleSort(col: string) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
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

  const sortIcon = (col: string) => {
    if (sortCol !== col) return ' ↕';
    return sortDir === 'desc' ? ' ↓' : ' ↑';
  };

  return (
    <div className="matrix-tab">
      <h2>3D Printing Filament Comparison</h2>
      <p className="section-desc">
        Comprehensive material property matrix for FDM/FFF 3D printing filaments.
        Based on the Learn By Layers filament comparison chart.
        Click column headers to sort. Ratings use a 1–5 dot scale.
      </p>

      <div className="matrix-controls">
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

      <div className="matrix-scroll-wrapper">
        <table className="matrix-table">
          <thead>
            <tr>
              <th className="matrix-th-material">Material</th>
              <th className="matrix-th sortable" onClick={() => handleSort('printTemp')}>Print Temp{sortIcon('printTemp')}</th>
              <th className="matrix-th sortable" onClick={() => handleSort('bedTemp')}>Bed Temp{sortIcon('bedTemp')}</th>
              <th className="matrix-th sortable" onClick={() => handleSort('strength')}>Strength{sortIcon('strength')}</th>
              <th className="matrix-th sortable" onClick={() => handleSort('flexibility')}>Flexibility{sortIcon('flexibility')}</th>
              <th className="matrix-th sortable" onClick={() => handleSort('durability')}>Durability{sortIcon('durability')}</th>
              <th className="matrix-th sortable" onClick={() => handleSort('difficulty')}>Difficulty{sortIcon('difficulty')}</th>
              <th className="matrix-th sortable" onClick={() => handleSort('shrinkage')}>Shrinkage{sortIcon('shrinkage')}</th>
              <th className="matrix-th">Soluble</th>
              <th className="matrix-th">Food Safe</th>
              <th className="matrix-th">Blue Tape</th>
              <th className="matrix-th">Glue Stick</th>
              <th className="matrix-th-uses">Typical Uses</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f, i) => (
              <tr key={i} className="matrix-row" style={{
                borderLeft: `4px solid ${f.color}`,
                animationDelay: `${i * 0.02}s`,
              }}>
                <td className="matrix-td-material">
                  <div className="matrix-material-name" style={{ color: f.color }}>{f.name}</div>
                  <div className="matrix-material-sub">{f.subtitle}</div>
                </td>
                <td className="matrix-td-temp">
                  <span className="matrix-temp-range">{f.printTemp}</span>
                </td>
                <td className="matrix-td-temp">
                  {f.bedTemp !== '—' && f.bedTemp !== 'N/A' ? (
                    <span className="matrix-temp-range">{f.bedTemp}</span>
                  ) : <span className="matrix-na">{f.bedTemp}</span>}
                </td>
                <td className="matrix-td-dots"><Dots count={f.strength} /></td>
                <td className="matrix-td-dots"><Dots count={f.flexibility} /></td>
                <td className="matrix-td-dots"><Dots count={f.durability} /></td>
                <td className="matrix-td-dots"><Dots count={f.difficulty} /></td>
                <td className="matrix-td-dots"><Dots count={f.shrinkage} /></td>
                <td className="matrix-td-center">
                  {f.soluble === '—' ? <span className="matrix-na">—</span> :
                    <span className={`matrix-soluble ${f.soluble.toLowerCase()}`}>{f.soluble}</span>}
                </td>
                <td className="matrix-td-center">
                  {f.foodSafe === '—' ? <span className="matrix-na">—</span> :
                    <span className={`matrix-foodsafe ${f.foodSafe.toLowerCase()}`}>{f.foodSafe}</span>}
                </td>
                <td className="matrix-td-center"><BoolCell value={f.blueTape} /></td>
                <td className="matrix-td-center"><BoolCell value={f.glueStick} /></td>
                <td className="matrix-td-uses">{f.typicalUses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="matrix-legend">
        <div className="matrix-legend-section">
          <span className="matrix-legend-title">Rating Scale</span>
          <div className="matrix-legend-row">
            {[1, 2, 3, 4, 5].map(n => (
              <div key={n} className="matrix-legend-item">
                <Dots count={n} />
                <span>{n === 1 ? 'Low' : n === 3 ? 'Medium' : n === 5 ? 'High' : ''}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="matrix-legend-section">
          <span className="matrix-legend-title">Adhesion</span>
          <div className="matrix-legend-row">
            <div className="matrix-legend-item"><BoolCell value={true} /><span>Works</span></div>
            <div className="matrix-legend-item"><BoolCell value={false} /><span>Not recommended</span></div>
            <div className="matrix-legend-item"><span className="matrix-na">—</span><span>N/A</span></div>
          </div>
        </div>
      </div>

      <p className="matrix-source">
        Source: Learn By Layers / ThreeDotZero Studios — 3D Printing Filament Comparison V1.1, May 2018.
        Temperature ranges in °C. Ratings are generalized across manufacturers — always verify with your specific filament brand.
      </p>
    </div>
  );
}
