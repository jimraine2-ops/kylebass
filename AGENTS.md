# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
StockPulse — a Korean-language AI-powered stock trading dashboard. React 18 + TypeScript + Vite frontend with Supabase BaaS backend (cloud-hosted at `eeoirpnqavjmvubzeqsd.supabase.co`). No local backend needed.

### Quick reference
- **Dev server:** `npm run dev` (Vite, port 8080)
- **Lint:** `npm run lint` (ESLint — pre-existing `@typescript-eslint/no-explicit-any` errors are expected)
- **Tests:** `npm test` (Vitest, 2 test files, 5 tests)
- **Build:** `npm run build`
- **Package manager:** npm (lockfile: `package-lock.json`). A `bun.lock`/`bun.lockb` also exists but npm is primary.

### Non-obvious notes
- The `.env` file ships with committed Supabase anon keys (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`). These are public/anon keys, not secrets.
- Supabase Edge Functions (9 total under `supabase/functions/`) are deployed to the cloud and called via `supabase.functions.invoke()`. They do NOT run locally unless you install the Supabase CLI.
- Finnhub and Twelve Data API keys are Supabase secrets (set via `supabase secrets set`), not in the local `.env`.
- Vite config uses `host: "::"` (dual-stack IPv4/IPv6). If `localhost:8080` fails, try `127.0.0.1:8080` or `[::1]:8080`.
- ESLint exits with code 1 due to many pre-existing `no-explicit-any` warnings — this is normal for this codebase and not a setup failure.
