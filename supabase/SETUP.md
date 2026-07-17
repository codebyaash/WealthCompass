# WealthCompass Demo Setup

This is the shortest path to a working local demo with:

- Supabase sign-in
- Supabase cloud sync
- Live Alpha Vantage market data
- Paytm Money import-based portfolio onboarding

## 1. Environment variables

Fill `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ALPHA_VANTAGE_API_KEY=...
CRON_SECRET=...
```

`WEALTHCOMPASS_SYNC_USER_IDS` is optional and only needed for scheduled sync demos.

## 2. Apply the database schema

1. Open your Supabase project dashboard
2. Go to `SQL Editor`
3. Open [schema.sql](/Users/ash/WealthCompass/supabase/schema.sql)
4. Copy its contents into Supabase
5. Run the query

This creates the tables and row-level security policies used by WealthCompass.

## 3. Enable email auth

In Supabase:

1. Open `Authentication`
2. Open `Providers`
3. Make sure `Email` is enabled

## 4. Start the app

From the project root:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Then open:

```text
http://127.0.0.1:3001
```

## 5. Sign in

Open:

```text
http://127.0.0.1:3001/auth
```

Create an account or sign in with an existing one.

After sign-in:

- the app should return to `/`
- the header should stop showing browser-only mode
- settings should reflect signed-in sync status

## 6. Check live market data

Open the `Market` tab.

If `ALPHA_VANTAGE_API_KEY` is valid, the app should use live market snapshots instead of fallback-only mode.

## 7. Demo Paytm Money portfolio import

Current Paytm Money support is import-first, not direct OAuth/API linking.

Use one of these:

- CSV export
- statement text
- forwarded email content
- PDF statement

Then import it through the portfolio/settings workflow inside the app.

## Current limitations

- Direct broker API sync is implemented for Zerodha only
- Paytm Money direct live account linking is not implemented yet
- Scheduled sync routes need additional deployment wiring if you want background automation
