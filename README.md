<div align="center">

# Blue UAS Platform Explorer

**Interactive specifications browser and thermal engineering toolkit for all 42 DoD Blue UAS Cleared List drone platforms.**

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6.4-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![NDAA](https://img.shields.io/badge/NDAA-Compliant-0d9f6e?style=flat-square)]()
[![Strict TS](https://img.shields.io/badge/tsconfig-strict%3A%20true-3178C6?style=flat-square)]()

---

*DCMA / Defense Innovation Unit · NDAA Section 848 / Section 889 Compliant Platforms*

</div>

---

## Overview

Blue UAS Platform Explorer is a single-page application for browsing, filtering, and analyzing the DoD Blue UAS Cleared List. Beyond basic specifications, it provides physics-based thermal degradation models and material science tooling drawn from the white paper *"Engineering sUAS Platforms for the Middle East: A Thermal Survival Framework."*

The application ships four feature tabs, each designed for a different operational planning context:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Blue UAS Platform Explorer                      │
├──────────────┬──────────────────┬────────────────┬─────────────────┤
│  Platform    │  Hot-Weather     │  Component     │  Filament       │
│  Directory   │  Performance     │  Physics       │  Matrix         │
├──────────────┴──────────────────┴────────────────┴─────────────────┤
│                                                                     │
│  42 platforms · 3 UAS groups · 14 mission types · 18 data fields   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Features

### Tab 1 — Platform Directory

The full Blue UAS Cleared List in a searchable, sortable interface.

| Capability | Detail |
|:---|:---|
| Platforms | 42 DCMA-cleared systems from 28 manufacturers |
| Sorting | Flight time, speed, weight, range, payload, or name |
| Filtering | UAS Group (1–3) and mission type |
| Detail Cards | Expandable per-platform specs with power source and max operating temperature |
| Summary Stats | Live counts for platforms, manufacturers, average and max endurance |

### Tab 2 — Hot-Weather Performance

Interactive Recharts visualizations showing performance degradation above 45°C (113°F).

| Chart | What It Shows |
|:---|:---|
| Endurance Comparison | Standard vs >45°C flight time (top 25 non-tethered platforms) |
| Range Comparison | Standard vs >45°C operational range (platforms >5 mi) |
| Speed vs Endurance Scatter | Cruise speed vs hot endurance, bubble-sized by weight, colored by UAS group |

Click any data point to expand full platform specifications inline.

### Tab 3 — Component Physics

Interactive thermal degradation models sourced directly from the sUAS desert engineering white paper. Adjust ambient temperature (15–55°C) and field elevation (sea level, 800m Amman, 1,500m Kurdistan) to see real-time compound effects.

**Three sub-panels:**

```
Component Physics
├── Propulsion Cascade
│   ├── Air density loss (ideal gas law)
│   ├── Prop thrust reduction (T = CT·ρ·n²·D⁴)
│   ├── Cu winding resistance rise (α = 0.00393/°C, NIST)
│   ├── NdFeB magnet flux loss (−11% at 120°C)
│   ├── MOSFET RDS(on) increase (+85% at 120°C)
│   ├── RPM / power increase for thrust recovery (n³ scaling)
│   ├── Total hover power escalation (+28–39%)
│   └── Stacked area chart: aero + motor I²R + ESC/battery
│
├── Battery Survival
│   ├── GO / COOL DOWN / DERATE / NO-GO decision flow
│   ├── Chemistry comparison table (LiPo vs Li-ion vs LiFePO4)
│   ├── Cycle life model (300–500 → 100–200 at sustained 45–55°C)
│   ├── Endurance retention curve with ×0.60–0.70 floor
│   └── Thermal mitigation protocol checklist
│
└── Airframe Materials
    ├── Polymer thermal survival map (8 materials vs tarmac soak temp)
    ├── Tg / HDT bar chart with dynamic failure threshold line
    ├── Recommended materials table with pass/fail per condition
    └── Black vs white surface temperature comparison
```

**Physics models implemented:**

| Function | Source | Formula / Basis |
|:---|:---|:---|
| `airDensity()` | Ideal gas law | `ρ = P / (R·T)` with lapse-rate pressure |
| `densityAltitudeFt()` | ISA atmosphere model | Ratio of actual to standard density |
| `tarmacTemp()` | White paper §2.1 | +20°C (white) to +30°C (dark) floor above ambient |
| `cuResistanceIncrease()` | NIST copper data | `α = 0.00393/°C` from 25°C reference |
| `motorWindingTemp()` | White paper §4.3 | Ambient + 70°C self-heating rise |
| `ndfebFluxLoss()` | White paper §4.1 | Linear to −11% at 120°C winding |
| `mosfetRdsIncrease()` | White paper §4.1 | Linear to +85% at 120°C |
| `thrustReductionPct()` | Thrust equation | `T ∝ ρ` at constant RPM |
| `powerIncreaseForThrust()` | White paper §4.2 | Power scales with `n³` → `(ρ_std/ρ_hot)^1.5` |
| `hoverPowerEscalation()` | White paper Table 3 | Compound: aero + motor + ESC/battery |
| `batteryStatus()` | White paper Figure 5 | GO/COOL/DERATE/NO-GO decision gates |
| `cycleLife()` | White paper §5.1 | 2–3× acceleration above 45°C sustained |
| `enduranceMultiplier()` | White paper §7.1 | ×0.60–0.70 floor at desert design day |

### Tab 4 — Filament Matrix

Comprehensive comparison matrix for 30 FDM/FFF 3D printing filaments.

| Feature | Detail |
|:---|:---|
| Materials | 30 filament types from PLA through PC and specialty materials |
| Properties | Strength, flexibility, durability, difficulty, shrinkage (1–5 dot scale) |
| Temperatures | Print temp and bed temp ranges in °C |
| Compatibility | Blue tape, glue stick, solubility, food safety |
| Sorting | Click any column header to sort ascending/descending |
| Search | Filter by material name, subtitle, or typical use |

---

## Architecture

```
blue-uas/
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx                 # Entry point with null-safe root mount
│   ├── App.tsx                  # Tab router, Platform Directory, Hot-Weather Performance
│   ├── ComponentPhysics.tsx     # Thermal degradation models (propulsion, battery, airframe)
│   ├── MaterialMatrix.tsx       # 30-filament comparison table
│   ├── data.ts                  # Drone interface + 42-platform dataset + formatTime()
│   └── index.css                # Complete stylesheet (691 lines, CSS custom properties)
├── index.html
├── package.json
├── tsconfig.json                # Project references
├── tsconfig.app.json            # strict: true, ES2023, React JSX
├── tsconfig.node.json           # Node-side config for Vite
├── vite.config.ts
├── eslint.config.js             # ESLint 9 flat config + typescript-eslint
├── railway.toml                 # Railway deployment config
└── nixpacks.toml                # Nixpacks build phases
```

### Data Model

Every platform in `data.ts` conforms to the `Drone` interface — 18 explicitly typed fields:

```
Drone
├── Identity ─────── id · manufacturer · model · type · group · mission
├── Performance ──── flight_time_min · max_speed_mph · range_mi
├── Physical ─────── weight_lbs · payload_lbs · tethered
├── Thermal ──────── operating_temp_max_c · hot_endurance_min · hot_range_mi · hot_speed_mph
├── Power ────────── power_source
└── Description ──── desc
```

---

## Code Quality Standards

This codebase adheres to 10 strict JavaScript/TypeScript coding principles:

| # | Principle | Status |
|:---:|:---|:---:|
| 1 | Early returns and simple flow control | ✓ |
| 2 | No global state or mutable shared data | ✓ |
| 3 | No `eval()`, `with`, `document.write()`, `any`, or `!` assertion | ✓ |
| 4 | `const` by default, `let` only for loop counters, never `var` | ✓ |
| 5 | `"strict": true` in tsconfig, ESLint + typescript-eslint | ✓ |
| 6 | No deep recursion — iterative loops and functional methods only | ✓ |
| 7 | Small pure functions with single responsibility | ✓ |
| 8 | Explicit `interface` / `type` declarations for all data shapes | ✓ |
| 9 | Standardized async error handling (N/A — no async operations) | ✓ |
| 10 | Never mutate built-in prototypes | ✓ |

**Verification:**

```bash
# Zero TypeScript errors with strict mode
npx tsc -b

# Confirm no 'any' type annotations in source
grep -rnE ': any\b' src/

# Confirm no non-null assertions in source
grep -rnE '[a-zA-Z0-9)]+!' src/ | grep -v '!=='

# Confirm no var declarations
grep -rnE '^\s*var\b' src/
```

---

## Deploy to Railway

### Option 1 — GitHub (Recommended)

1. Push this repository to GitHub.
2. Navigate to [railway.app](https://railway.app).
3. Click **New Project → Deploy from GitHub Repo**.
4. Select this repository.
5. Railway auto-detects the build via `railway.toml` and `nixpacks.toml`.
6. Add a domain under **Settings → Networking → Generate Domain**.

### Option 2 — Railway CLI

```bash
npm install -g @railway/cli
railway login
railway init
railway up
railway domain
```

---

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Production Build

```bash
npm run build
npm run start
```

Serves on [http://localhost:3000](http://localhost:3000) (or `$PORT` on Railway).

---

## Tech Stack

| Layer | Technology |
|:---|:---|
| Framework | React 19 |
| Language | TypeScript 5.9 (`strict: true`) |
| Bundler | Vite 6.4 |
| Charts | Recharts 3.8 |
| Typography | Outfit (UI) + JetBrains Mono (data) |
| Static Host | `serve` 14.2 |
| Linting | ESLint 9 + typescript-eslint 8.57 |
| Deployment | Railway (Nixpacks) |

---

## Data Sources

| Source | Usage |
|:---|:---|
| DCMA Blue UAS Cleared List | Platform names, manufacturers, UAS groups |
| Manufacturer data sheets | Flight time, speed, range, payload, weight, operating temps |
| Official DoD publications | Mission types, group classifications |
| sUAS thermal engineering white paper | All physics models, degradation curves, material tables |
| LiPo degradation research (ScienceDirect 2020) | Battery cycle life and endurance derating models |
| Learn By Layers Filament Comparison V1.1 | 30-material property matrix |

---

<div align="center">

**Blue UAS Cleared List — DCMA / Defense Innovation Unit**

All 42 platforms NDAA-compliant and validated as cyber-secure.

</div>
