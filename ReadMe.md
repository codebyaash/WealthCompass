# WealthCompass

Find your financial direction.

WealthCompass is a free-first investment companion MVP built with Next.js,
TypeScript, Tailwind, shadcn-style components, Recharts, and Supabase-ready
data modeling.

## Phase 1: Foundation

- Dashboard-first product shell
- Beginner onboarding questionnaire
- Rule-based risk profile calculator
- Investor personality result
- Learning roadmap
- Investment category library
- Manual portfolio tracker
- Goal planner
- Portfolio health score
- Supabase schema and auth-ready screen

## Phase 2: Beginner Journey

- Multi-step financial profile flow
- Country, income, goal, learning-time, and tax-awareness inputs
- Investor confidence state
- Richer investor personality summary
- Personalized next actions
- Six-week learning roadmap with lesson/checklist/practice formats
- Expanded investment academy cards with liquidity and beginner notes

## Phase 3: Tracking

- Local manual portfolio state
- Add-asset workflow
- Allocation chart from current holdings
- Rule-based portfolio health checks
- Goal planner remains live and editable

## Phase 4: Persistence Foundation

- Supabase Auth form wired for email/password
- Safe local demo mode when Supabase env vars are missing
- Browser autosave for onboarding, portfolio, and goal state
- RLS-ready Supabase schema for profiles, risk profiles, assets, and goals

## Phase 5: Account Cloud Sync

- Detects signed-in Supabase users
- Loads saved profile, portfolio, and goal data after sign-in
- Debounced cloud sync for current dashboard state
- Manual risk-profile history save
- Header sync status for local, syncing, synced, and error states

## Phase 6: Risk History

- History tab for saved risk profile snapshots
- Local browser history for demos without Supabase
- Supabase history loading for signed-in users
- Empty state that explains how to save the current risk profile

## Phase 7: Investment Comparator

- Interactive comparisons inside Investment Academy
- ETF vs mutual fund, gold vs bonds, SIP vs lump sum, FD vs debt fund, REIT vs property
- Side-by-side risk, effort, liquidity, fit, and tax notes
- Beginner pick and plain-language recommendation for each comparison

## Phase 8: Market Dashboard

- Dedicated Market tab
- Manual/free-data-ready market snapshot cards
- Sector movement chart
- Rule-based market sentiment score
- Beginner explanations that translate market noise into action context

## Phase 9: Portfolio CSV Import

- Paste CSV holdings into the portfolio tracker
- Supports `name,type,value,gain` columns with simple header aliases
- Validates required fields and imports multiple holdings at once
- Keeps the free/manual flow while preparing for broker and file imports

## Phase 10: Portfolio Export and Reset

- Copy current portfolio as CSV
- Download current portfolio as `wealthcompass-portfolio.csv`
- Reset portfolio back to demo data
- Completes the free import/export loop before broker integrations

## Phase 11: Rule-Based Mentor

- Dedicated Mentor tab
- Beginner explanations for ETF, SIP, emergency fund, crashes, gold, and risk score
- Personalized notes using current onboarding answers and risk profile
- Designed so OpenAI can replace the answer engine later without changing the UI

## Phase 12: Settings and Data Controls

- Dedicated Settings tab
- Local and Supabase sync status summary
- Full workspace export as readable JSON
- Copy and download controls for account portability
- Portfolio and full demo workspace reset actions

## Phase 13: Data Import and Portfolio Editing

- Import full workspace JSON exports from Settings
- Defensive import validation for onboarding, portfolio, goals, and risk history data
- Edit individual portfolio holdings inline
- Delete portfolio holdings from the manual tracker
- Load CSV files into the import preview before applying holdings

## Phase 14: Multi-Goal Planning

- Store and sync multiple financial goals
- Add, edit, and delete goals from the planner
- Priority labels for essential, important, and aspirational goals
- Combined monthly investment target across all goals
- Goal split chart and rule-based planning checks

## Phase 15: Dashboard Command Center

- Rule-based next best action on the dashboard
- Quick action buttons for profile, portfolio, goals, and academy
- Portfolio allocation snapshot from manual holdings
- Goal progress summary across all active goals
- Dashboard links into the main MVP workflows

## Phase 16: Testing Foundation

- Node test runner with TypeScript compilation
- Unit tests for risk profile scoring and band behavior
- Unit tests for goal monthly investment math
- Unit tests for CSV import validation
- Unit tests for CSV export escaping

## Phase 17: API Input Hardening

- Extracted risk profile request normalization into a reusable library
- Defaults invalid enum values before scoring
- Defaults non-finite numeric inputs before scoring
- Keeps the API route thin and focused on request/response handling
- Unit tests for untrusted risk profile request payloads

## Phase 18: CI Quality Gate

- GitHub Actions runs install, lint, tests, and production build
- Pull request template includes validation checklist
- Keeps rule-based logic, API hardening, and build health visible before deploys
- Uses only the free GitHub Actions and Vercel-friendly workflow path

## Phase 19: Rule Engine Extraction

- Moved dashboard next-action rules into `lib/dashboard-rules.ts`
- Moved mentor question and answer rules into `lib/mentor-rules.ts`
- Kept UI components focused on rendering and interaction
- Added tests for dashboard action priority
- Added tests for mentor personalization rules

## Phase 20: Workspace Import Test Coverage

- Added tests for full workspace JSON import
- Added tests for legacy single-goal export migration
- Added tests for invalid JSON and missing import sections
- Added tests for default goal creation
- Kept storage utilities runnable in the plain Node test environment

## Phase 21: Supabase Mapping Test Coverage

- Extracted Supabase row mapping into `lib/supabase-mappers.ts`
- Kept cloud sync focused on Supabase reads and writes
- Added tests for profile answer mapping
- Added tests for portfolio and goal insert payloads
- Added tests for risk history fallback mapping

## Phase 22: Portfolio Health Rules

- Extracted portfolio health checks into `lib/portfolio-rules.ts`
- Added largest-holding concentration calculation
- Added suggested index fund core lookup
- Kept portfolio tracker rendering separate from recommendation logic
- Added tests for portfolio health statuses

## Phase 23: Goal Planning Rules

- Extracted goal progress and funding-gap logic into `lib/goal-rules.ts`
- Added multi-goal summary helpers
- Added monthly split chart data helper
- Added planning check helper for goal warnings
- Added tests for goal planner rule outputs

## Phase 24: Dashboard Component Split

- Moved Dashboard into `components/wealth/dashboard.tsx`
- Moved shared Roadmap into `components/wealth/roadmap.tsx`
- Moved money and date formatting into `lib/formatters.ts`
- Reduced the main app component without changing dashboard behavior
- Kept dashboard navigation wired into the existing app shell

## Phase 25: Market Component Split

- Moved Market Dashboard into `components/wealth/market-dashboard.tsx`
- Kept the manual market snapshot and beginner sentiment UI together
- Removed market-only constants and trend icons from the main app shell
- Preserved the free-data-ready market tab behavior
- Continued reducing `wealth-compass-app.tsx` toward screen-level ownership

## Phase 26: Mentor Component Split

- Moved Investment Mentor into `components/wealth/mentor-panel.tsx`
- Kept mentor question state local to the Mentor tab
- Kept rule-based mentor answers in `lib/mentor-rules.ts`
- Removed mentor-rule imports from the main app shell
- Preserved the future AI swap point without changing the current free MVP behavior

## Run Locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Run checks with:

```bash
npm run lint
npm test
npm run build
```

The app also runs without Supabase keys. In that mode, data autosaves in
`localStorage` so the MVP remains portfolio-demo friendly.

## Supabase Setup

1. Create a free Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local`.
4. Add:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

5. Restart `npm run dev`.

After signing in, WealthCompass syncs local demo data into the user's Supabase
rows and keeps the dashboard state saved.

## Free MVP Stack

- Frontend: Next.js + TypeScript + Tailwind
- Backend: Next.js route handlers
- Database/Auth: Supabase Free
- Charts: Recharts
- AI: rule-based logic first
- Hosting: Vercel Free
