import { Injectable, signal } from '@angular/core';
import { DEFAULT_SETTINGS } from '../models/app-settings.model';
import { DEFAULT_EMPLOYEE_NAME, Employee } from '../models/employee.model';
import { getSupabaseClient, isSupabaseConfigured } from '../supabase/supabase.client';
import { ClientIdService } from './client-id.service';

const LOCAL_EMPLOYEES_KEY = 'moms-employees';
const LOCAL_ACTIVE_EMPLOYEE_KEY = 'moms-active-employee-id';

interface EmployeeRow {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
}

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  readonly employees = signal<Employee[]>([]);
  readonly activeEmployee = signal<Employee | null>(null);
  readonly ready = signal(false);

  constructor(private readonly clientIdService: ClientIdService) {}

  async initialize(): Promise<void> {
    let loaded = await this.loadEmployeesRemote();

    if (loaded.length === 0) {
      const local = this.loadEmployeesLocal();
      if (local.length > 0) {
        loaded = isSupabaseConfigured() ? await this.syncEmployeesToRemote(local) : local;
      }
    }

    if (loaded.length === 0) {
      const created = await this.createEmployee(DEFAULT_EMPLOYEE_NAME);
      loaded = [created];
    }

    this.employees.set(loaded.sort((a, b) => a.sortOrder - b.sortOrder));
    this.saveEmployeesLocal(this.employees());

    const activeId =
      (await this.loadActiveEmployeeIdRemote()) ??
      this.loadActiveEmployeeIdLocal() ??
      loaded.find((employee) => employee.active)?.id ??
      null;
    const active =
      loaded.find((employee) => employee.id === activeId && employee.active) ??
      loaded.find((employee) => employee.active) ??
      loaded[0];

    this.activeEmployee.set(active ?? null);
    await this.persistActiveEmployee(active?.id ?? null);
    this.ready.set(true);
  }

  activeEmployees(): Employee[] {
    return this.employees().filter((employee) => employee.active);
  }

  async createEmployee(name: string): Promise<Employee> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Employee name is required');
    }

    const employee: Employee = {
      id: crypto.randomUUID(),
      name: trimmed,
      active: true,
      sortOrder: this.employees().length,
    };

    const synced = isSupabaseConfigured() ? await this.insertEmployeeRemote(employee) : employee;
    if (isSupabaseConfigured() && !synced) {
      throw new Error('No se pudo guardar el empleado en el servidor.');
    }

    const saved = synced ?? employee;
    this.employees.update((list) => [...list, saved].sort((a, b) => a.sortOrder - b.sortOrder));
    this.saveEmployeesLocal(this.employees());

    if (!this.activeEmployee()) {
      this.activeEmployee.set(saved);
      await this.persistActiveEmployee(saved.id);
    }

    return saved;
  }

  async renameEmployee(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    const current = this.employees().find((employee) => employee.id === id);
    if (!current) {
      return;
    }

    const updated: Employee = { ...current, name: trimmed };

    if (isSupabaseConfigured()) {
      const remote = await this.upsertEmployeeRemote(updated);
      if (!remote && this.clientIdService.isSharedWorkspace()) {
        throw new Error('No se pudo actualizar el empleado en el servidor.');
      }
    }

    this.employees.update((list) =>
      list.map((employee) => (employee.id === id ? updated : employee)),
    );
    this.saveEmployeesLocal(this.employees());

    const active = this.activeEmployee();
    if (active?.id === id) {
      this.activeEmployee.set(updated);
    }
  }

  async archiveEmployee(id: string): Promise<void> {
    const activeList = this.activeEmployees();
    if (activeList.length <= 1 && activeList.some((employee) => employee.id === id)) {
      return;
    }

    const current = this.employees().find((employee) => employee.id === id);
    if (!current) {
      return;
    }

    const archived: Employee = { ...current, active: false };

    if (isSupabaseConfigured()) {
      const remote = await this.upsertEmployeeRemote(archived);
      if (!remote && this.clientIdService.isSharedWorkspace()) {
        throw new Error('No se pudo archivar el empleado en el servidor.');
      }
    }

    this.employees.update((list) =>
      list.map((employee) => (employee.id === id ? archived : employee)),
    );
    this.saveEmployeesLocal(this.employees());

    if (this.activeEmployee()?.id === id) {
      const next = this.activeEmployees()[0] ?? null;
      this.activeEmployee.set(next);
      await this.persistActiveEmployee(next?.id ?? null);
    }
  }

  async setActiveEmployee(id: string): Promise<void> {
    const employee = this.employees().find((item) => item.id === id && item.active);
    if (!employee) {
      return;
    }

    this.activeEmployee.set(employee);
    await this.persistActiveEmployee(id);
  }

  private async syncEmployeesToRemote(employees: Employee[]): Promise<Employee[]> {
    const synced: Employee[] = [];

    for (const employee of employees) {
      const remote = await this.upsertEmployeeRemote(employee);
      if (remote) {
        synced.push(remote);
      }
    }

    if (synced.length === 0) {
      return employees;
    }

    return synced.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  private async persistActiveEmployee(id: string | null): Promise<void> {
    if (id) {
      localStorage.setItem(LOCAL_ACTIVE_EMPLOYEE_KEY, id);
    } else {
      localStorage.removeItem(LOCAL_ACTIVE_EMPLOYEE_KEY);
    }

    if (!isSupabaseConfigured() || !id) {
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }

    const { error } = await supabase.from('salary_settings').upsert(
      {
        client_id: this.clientIdService.getClientId(),
        active_employee_id: id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id' },
    );

    if (error) {
      console.error('Failed to persist active employee', error.message);
    }
  }

  private async loadEmployeesRemote(): Promise<Employee[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, active, sort_order')
        .eq('client_id', this.clientIdService.getClientId())
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Failed to load employees', error.message);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((row) => this.mapEmployeeRow(row as EmployeeRow));
    } catch (error) {
      console.error('Failed to load employees', error);
      return [];
    }
  }

  private async insertEmployeeRemote(employee: Employee): Promise<Employee | null> {
    return this.upsertEmployeeRemote(employee);
  }

  private async upsertEmployeeRemote(employee: Employee): Promise<Employee | null> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('employees')
        .upsert(
          {
            id: employee.id,
            client_id: this.clientIdService.getClientId(),
            name: employee.name,
            active: employee.active,
            sort_order: employee.sortOrder,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' },
        )
        .select('id, name, active, sort_order')
        .single();

      if (error || !data) {
        console.error('Failed to save employee', error?.message);
        return null;
      }

      const { error: settingsError } = await supabase.from('employee_settings').upsert(
        {
          employee_id: data.id,
          hourly_rate: DEFAULT_SETTINGS.hourlyRate,
          default_hours_per_day: DEFAULT_SETTINGS.defaultHoursPerDay,
          holiday_hourly_rate: DEFAULT_SETTINGS.holidayHourlyRate,
          weekend_hourly_rate: DEFAULT_SETTINGS.weekendHourlyRate,
          payment_period_type: DEFAULT_SETTINGS.paymentPeriodType,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'employee_id' },
      );

      if (settingsError) {
        console.error('Failed to save employee settings', settingsError.message);
      }

      return this.mapEmployeeRow(data as EmployeeRow);
    } catch (error) {
      console.error('Failed to save employee', error);
      return null;
    }
  }

  private async loadActiveEmployeeIdRemote(): Promise<string | null> {
    if (!isSupabaseConfigured()) {
      return null;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('salary_settings')
        .select('active_employee_id')
        .eq('client_id', this.clientIdService.getClientId())
        .maybeSingle();

      if (error || !data?.active_employee_id) {
        return null;
      }

      return data.active_employee_id as string;
    } catch {
      return null;
    }
  }

  private loadEmployeesLocal(): Employee[] {
    try {
      const raw = localStorage.getItem(LOCAL_EMPLOYEES_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as Employee[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveEmployeesLocal(employees: Employee[]): void {
    localStorage.setItem(LOCAL_EMPLOYEES_KEY, JSON.stringify(employees));
  }

  private loadActiveEmployeeIdLocal(): string | null {
    return localStorage.getItem(LOCAL_ACTIVE_EMPLOYEE_KEY);
  }

  private mapEmployeeRow(row: EmployeeRow): Employee {
    return {
      id: row.id,
      name: row.name,
      active: Boolean(row.active),
      sortOrder: Number(row.sort_order),
    };
  }
}
