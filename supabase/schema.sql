create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  country text,
  age integer,
  annual_income numeric,
  dependents integer,
  income_stability text check (income_stability in ('variable', 'steady', 'very-steady')),
  monthly_savings numeric,
  monthly_investment numeric,
  emergency_months integer default 0,
  debt_level text check (debt_level in ('none', 'manageable', 'heavy')),
  experience text check (experience in ('new', 'some', 'confident')),
  horizon_years integer,
  liquidity_needs text check (liquidity_needs in ('high', 'medium', 'low')),
  market_drop_response text check (market_drop_response in ('sell', 'wait', 'buy')),
  post_learning_drop_response text check (post_learning_drop_response in ('sell', 'wait', 'buy')),
  decision_style text check (decision_style in ('hands-off', 'guided', 'active')),
  primary_goal text check (
    primary_goal in ('emergency', 'home', 'retirement', 'wealth', 'education', 'travel')
  ),
  time_available text check (time_available in ('low', 'medium', 'high')),
  tax_awareness text check (tax_awareness in ('low', 'medium', 'high')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles
add column if not exists dependents integer;

alter table public.profiles
add column if not exists income_stability text check (
  income_stability in ('variable', 'steady', 'very-steady')
);

alter table public.profiles
add column if not exists liquidity_needs text check (
  liquidity_needs in ('high', 'medium', 'low')
);

alter table public.profiles
add column if not exists post_learning_drop_response text check (
  post_learning_drop_response in ('sell', 'wait', 'buy')
);

alter table public.profiles
add column if not exists decision_style text check (
  decision_style in ('hands-off', 'guided', 'active')
);

create table if not exists public.risk_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null,
  band text not null,
  personality text not null,
  confidence text,
  summary text,
  allocation jsonb not null default '[]',
  roadmap jsonb not null default '[]',
  next_actions jsonb not null default '[]',
  answers jsonb not null,
  recommendations jsonb not null default '[]',
  created_at timestamptz default now()
);

create table if not exists public.portfolio_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  asset_type text not null,
  quantity numeric default 0,
  average_price numeric default 0,
  current_price numeric default 0,
  invested_value numeric default 0,
  current_value numeric not null default 0,
  gain_percent numeric default 0,
  source_label text default 'Imported',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.portfolio_assets
add column if not exists current_price numeric default 0;

alter table public.portfolio_assets
add column if not exists invested_value numeric default 0;

alter table public.portfolio_assets
add column if not exists source_label text default 'Imported';

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  target_amount numeric not null,
  current_amount numeric not null default 0,
  years integer not null,
  expected_return numeric not null default 8,
  priority text not null default 'important' check (
    priority in ('essential', 'important', 'aspirational')
  ),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.portfolio_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  asset_name text not null,
  asset_type text default 'Other',
  action_type text not null default 'buy' check (
    action_type in ('buy', 'sell', 'dividend', 'transfer')
  ),
  quantity numeric default 0,
  price numeric default 0,
  amount numeric default 0,
  source_label text default 'Imported',
  notes text,
  transaction_date date default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.import_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider_id text not null,
  provider_name text not null,
  channel text not null check (channel in ('broker', 'registrar', 'email', 'file')),
  status text not null default 'active' check (status in ('active', 'paused', 'error')),
  last_synced_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.import_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  import_source_id uuid references public.import_sources(id) on delete set null,
  file_name text not null,
  file_type text not null,
  storage_path text,
  detected_provider text,
  import_status text not null default 'received' check (
    import_status in ('received', 'parsed', 'needs_review', 'failed')
  ),
  extracted_text text,
  parse_summary jsonb not null default '{}',
  created_at timestamptz default now()
);

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  import_document_id uuid references public.import_documents(id) on delete cascade,
  started_at timestamptz default now(),
  completed_at timestamptz,
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'completed', 'failed')
  ),
  error_message text,
  created_assets integer not null default 0,
  created_transactions integer not null default 0,
  job_payload jsonb not null default '{}'
);

create table if not exists public.market_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  auto_refresh boolean not null default true,
  include_holdings_watch boolean not null default true,
  polling_interval_seconds integer not null default 60,
  preferred_source text not null default 'alpha-vantage' check (
    preferred_source in ('alpha-vantage', 'fallback')
  ),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.inbox_connections (
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'outlook')),
  provider_account_email text,
  status text not null default 'needs_auth' check (
    status in ('connected', 'needs_auth', 'error', 'paused')
  ),
  scopes text[] not null default '{}',
  external_account_id text,
  access_token text,
  refresh_token text,
  access_token_expires_at timestamptz,
  sync_cursor text,
  last_synced_at timestamptz,
  last_message_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (user_id, provider)
);

create table if not exists public.market_snapshots (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  source text not null,
  preferred_source text not null default 'alpha-vantage' check (
    preferred_source in ('alpha-vantage', 'fallback')
  ),
  message text,
  sentiment text,
  sentiment_score integer,
  snapshot_tiles jsonb not null default '[]',
  sectors jsonb not null default '[]',
  holdings_watch jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.broker_connections (
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('zerodha')),
  account_label text,
  status text not null default 'needs_auth' check (
    status in ('connected', 'needs_auth', 'error', 'paused')
  ),
  scopes text[] not null default '{}',
  external_account_id text,
  access_token text,
  refresh_token text,
  access_token_expires_at timestamptz,
  last_synced_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (user_id, provider)
);

create index if not exists portfolio_assets_user_id_idx
on public.portfolio_assets(user_id);

create index if not exists portfolio_transactions_user_id_date_idx
on public.portfolio_transactions(user_id, transaction_date desc);

create index if not exists import_sources_user_id_idx
on public.import_sources(user_id);

create index if not exists import_documents_user_id_created_at_idx
on public.import_documents(user_id, created_at desc);

create index if not exists import_jobs_user_id_started_at_idx
on public.import_jobs(user_id, started_at desc);

create index if not exists inbox_connections_user_id_updated_at_idx
on public.inbox_connections(user_id, updated_at desc);

create index if not exists market_snapshots_updated_at_idx
on public.market_snapshots(updated_at desc);

create index if not exists broker_connections_user_id_updated_at_idx
on public.broker_connections(user_id, updated_at desc);

create index if not exists goals_user_id_updated_at_idx
on public.goals(user_id, updated_at desc);

create index if not exists risk_profiles_user_id_created_at_idx
on public.risk_profiles(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.risk_profiles enable row level security;
alter table public.portfolio_assets enable row level security;
alter table public.goals enable row level security;
alter table public.portfolio_transactions enable row level security;
alter table public.import_sources enable row level security;
alter table public.import_documents enable row level security;
alter table public.import_jobs enable row level security;
alter table public.market_preferences enable row level security;
alter table public.inbox_connections enable row level security;
alter table public.market_snapshots enable row level security;
alter table public.broker_connections enable row level security;

create policy "Users can read own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can insert own profile"
on public.profiles for insert
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can manage own risk profiles"
on public.risk_profiles for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own portfolio assets"
on public.portfolio_assets for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own goals"
on public.goals for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own portfolio transactions"
on public.portfolio_transactions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own import sources"
on public.import_sources for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own import documents"
on public.import_documents for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own import jobs"
on public.import_jobs for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own market preferences"
on public.market_preferences for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own inbox connections"
on public.inbox_connections for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own market snapshots"
on public.market_snapshots for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own broker connections"
on public.broker_connections for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
