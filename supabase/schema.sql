create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  country text,
  age integer,
  annual_income numeric,
  monthly_savings numeric,
  monthly_investment numeric,
  emergency_months integer default 0,
  debt_level text check (debt_level in ('none', 'manageable', 'heavy')),
  experience text check (experience in ('new', 'some', 'confident')),
  horizon_years integer,
  market_drop_response text check (market_drop_response in ('sell', 'wait', 'buy')),
  primary_goal text check (
    primary_goal in ('emergency', 'home', 'retirement', 'wealth', 'education', 'travel')
  ),
  time_available text check (time_available in ('low', 'medium', 'high')),
  tax_awareness text check (tax_awareness in ('low', 'medium', 'high')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
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
  current_value numeric not null default 0,
  gain_percent numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  target_amount numeric not null,
  current_amount numeric not null default 0,
  years integer not null,
  expected_return numeric not null default 8,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists portfolio_assets_user_id_idx
on public.portfolio_assets(user_id);

create index if not exists goals_user_id_updated_at_idx
on public.goals(user_id, updated_at desc);

create index if not exists risk_profiles_user_id_created_at_idx
on public.risk_profiles(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.risk_profiles enable row level security;
alter table public.portfolio_assets enable row level security;
alter table public.goals enable row level security;

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
