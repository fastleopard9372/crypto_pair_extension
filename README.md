# Crypto Pair Snapshot Dashboard

FastAPI + PostgreSQL + Prisma + Next.js dashboard for reading MEXC spot pairs by quote kind, saving timestamped snapshots, analyzing pairs with change percent above a threshold, and opening a TradingView chart for a selected pair.

## Run Locally

1. Start Postgres:

```bash
docker compose up -d postgres
```

2. Start the backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
prisma generate --schema prisma/schema.prisma
prisma db push --schema prisma/schema.prisma
uvicorn app.main:app --reload --port 8000
```

3. Start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Flow

- Choose a quote kind such as `USDT`, `USDC`, `BTC`, or `ETH`.
- Live pairs refresh automatically from MEXC public market data.
- Click `Save Snapshot` to store the current kind's pairs with the current timestamp.
- Click `Read Saved Data` to load the saved timestamp matrix.
- Click `Analyze` to recommend pairs where `change_percent >= X`.
- The analyzer also reports the change percent cutoff where the configured target count, default `80%`, of saved pairs are `X%+`.
- Click any pair row to open its TradingView chart.

## Database

The backend uses Prisma Client Python and PostgreSQL only. The Prisma schema is at `backend/prisma/schema.prisma`; it maps to the `market_snapshots` and `pair_ticks` Postgres tables.
