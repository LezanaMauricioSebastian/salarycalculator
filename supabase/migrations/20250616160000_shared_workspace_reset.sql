-- Espacio compartido: la app usa SHARED_CLIENT_ID = c411c101-0000-4000-8000-000000000001
-- Borra datos viejos (cada dispositivo tenía su propio client_id). Volvé a cargar empleados en la app.

delete from public.work_day_entries;
delete from public.work_periods;
delete from public.employee_settings;
delete from public.employees;
delete from public.salary_settings;
