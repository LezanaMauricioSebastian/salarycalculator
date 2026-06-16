alter table public.employee_settings
  add column if not exists weekend_hourly_rate numeric not null default 4800;
