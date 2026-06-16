create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employees_client_idx on public.employees (client_id);

create table if not exists public.employee_settings (
  employee_id uuid primary key references public.employees(id) on delete cascade,
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

alter table public.salary_settings
  add column if not exists active_employee_id uuid references public.employees(id) on delete set null;

alter table public.work_periods
  add column if not exists employee_id uuid references public.employees(id) on delete cascade;

do $$
declare
  rec record;
  new_employee_id uuid;
  settings_found boolean;
begin
  for rec in
    select distinct client_id from (
      select client_id from public.salary_settings
      union
      select client_id from public.work_periods
    ) as clients
  loop
    insert into public.employees (client_id, name, sort_order)
    values (rec.client_id, 'Empleado principal', 0)
    returning id into new_employee_id;

    settings_found := false;

    insert into public.employee_settings (
      employee_id,
      hourly_rate,
      default_hours_per_day,
      holiday_hourly_rate,
      payment_period_type,
      last_year,
      last_month,
      last_quincena
    )
    select
      new_employee_id,
      ss.hourly_rate,
      ss.default_hours_per_day,
      ss.holiday_hourly_rate,
      ss.payment_period_type,
      ss.last_year,
      ss.last_month,
      ss.last_quincena
    from public.salary_settings ss
    where ss.client_id = rec.client_id;

    if found then
      settings_found := true;
    end if;

    if not settings_found then
      insert into public.employee_settings (employee_id)
      values (new_employee_id);
    end if;

    update public.work_periods
    set employee_id = new_employee_id
    where client_id = rec.client_id
      and employee_id is null;

    update public.salary_settings
    set active_employee_id = new_employee_id
    where client_id = rec.client_id;
  end loop;
end $$;

alter table public.work_periods
  drop constraint if exists work_periods_client_id_year_month_quincena_period_type_key;

alter table public.work_periods
  alter column employee_id set not null;

alter table public.work_periods
  add constraint work_periods_employee_period_unique
  unique (employee_id, year, month, quincena, period_type);

create index if not exists work_periods_employee_idx on public.work_periods (employee_id);

alter table public.employees enable row level security;
alter table public.employee_settings enable row level security;

create policy "employees_anon_all"
  on public.employees for all
  using (true) with check (true);

create policy "employee_settings_anon_all"
  on public.employee_settings for all
  using (true) with check (true);
