# Crypto Pair Snapshot Dashboard

FastAPI + PostgreSQL + Prisma + Next.js dashboard for reading MEXC spot pairs by
quote kind, saving timestamped snapshots, analyzing pairs with change percent
above a threshold, and opening a TradingView chart for a selected pair.

## Run With NeonDB

1. Create a NeonDB Postgres database.

Copy the connection string from Neon. It should look like:

```bash
postgresql://USER:PASSWORD@HOST.neon.tech/neondb?sslmode=require
```

2. Start the backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env and paste your NeonDB DATABASE_URL
prisma generate --schema prisma/schema.prisma
prisma db push --schema prisma/schema.prisma
uvicorn app.main:app --reload --port 8080
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
- Click `Save Snapshot` to store the current kind's pairs with the current
  timestamp.
- Click `Read Saved Data` to load the saved timestamp matrix.
- Click `Analyze` to recommend pairs where `change_percent >= X`.
- The analyzer also reports the change percent cutoff where the configured
  target count, default `80%`, of saved pairs are `X%+`.
- Click the star on any live pair to save/remove it as a favorite pair in the
  database.
- Click any pair row to open its TradingView chart.

## Database

The backend uses Prisma Client Python and NeonDB/PostgreSQL only. The Prisma
schema is at `backend/prisma/schema.prisma`; it maps to the `market_snapshots`
`pair_ticks`, and `favorite_pairs` Postgres tables. Run
`prisma db push --schema prisma/schema.prisma` after schema changes.
