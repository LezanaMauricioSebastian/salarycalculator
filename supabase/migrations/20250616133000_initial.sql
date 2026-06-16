-- Proyecto: calculate_salary

create table if not exists public.salary_settings (
  client_id text primary key,
  hourly_rate numeric not null default 4000,
  default_hours_per_day numeric not null default 8,
  holiday_hourly_rate numeric not null default 4800,
  payment_period_type text not null default 'quincenal'
    check (payment_period_type in ('quincenal', 'mensual')),
  last_year integer,
  last_month integer check (last_month between 0 and 11),
  last_quincena text check (last_quincena in ('primera', 'segunda')),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_periods (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  year integer not null,
  month integer not null check (month between 0 and 11),
  quincena text not null default 'full' check (quincena in ('primera', 'segunda', 'full')),
  period_type text not null check (period_type in ('quincenal', 'mensual')),
  updated_at timestamptz not null default now(),
  unique (client_id, year, month, quincena, period_type)
);

create table if not exists public.work_day_entries (
  period_id uuid not null references public.work_periods(id) on delete cascade,
  work_date date not null,
  selected boolean not null default false,
  hours numeric not null default 8,
  primary key (period_id, work_date)
);

create index if not exists work_periods_client_idx on public.work_periods (client_id);
create index if not exists work_day_entries_period_idx on public.work_day_entries (period_id);

alter table public.salary_settings enable row level security;
alter table public.work_periods enable row level security;
alter table public.work_day_entries enable row level security;

create policy "salary_settings_anon_all"
  on public.salary_settings for all
  using (true) with check (true);

create policy "work_periods_anon_all"
  on public.work_periods for all
  using (true) with check (true);

create policy "work_day_entries_anon_all"
  on public.work_day_entries for all
  using (true) with check (true);
