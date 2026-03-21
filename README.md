# Blue UAS Platform Explorer

Specifications browser for 42 DoD Blue UAS Cleared List drone platforms with hot-weather performance analysis.

## Features

**Platform Directory Tab**
- 42 Blue UAS cleared platforms with full specifications.
- Sort by flight time, speed, weight, range, or payload.
- Filter by UAS group (1-3) and mission type.
- Expandable cards with detailed specs, power source, and operating temperature ratings.

**Hot-Weather Performance Tab**
- Interactive charts showing endurance, range, and speed degradation above 45C (113F).
- Endurance comparison: standard vs hot conditions (top 25 platforms).
- Range comparison: standard vs hot conditions (platforms >5 mi range).
- Scatter plot: cruise speed vs endurance at >45C, sized by weight, colored by UAS group.
- Click any data point for full platform specifications.

## Deploy to Railway

### Option 1: GitHub (recommended)

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app)
3. Click **New Project** > **Deploy from GitHub Repo**
4. Select this repository
5. Railway auto-detects the build via `railway.toml` and `nixpacks.toml`
6. Add a domain under **Settings > Networking > Generate Domain**

### Option 2: Railway CLI

```bash
npm install -g @railway/cli
railway login
railway init
railway up
railway domain
```

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build for Production

```bash
npm run build
npm run start
```

Serves on http://localhost:3000 (or $PORT on Railway)

## Tech Stack

- React 19 + TypeScript
- Vite 8
- Recharts for data visualization
- Outfit + JetBrains Mono typography
- `serve` for static hosting on Railway
