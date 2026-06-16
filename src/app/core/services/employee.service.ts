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
  readonly lastSyncError = signal<string | null>(null);

  constructor(private readonly clientIdService: ClientIdService) {}

  async initialize(): Promise<void> {
    this.lastSyncError.set(null);

    const remote = await this.loadEmployeesRemote();
    const local = this.loadEmployeesLocal();
    let loaded = await this.reconcileEmployees(remote, local);

    if (loaded.length === 0) {
      loaded = [await this.createEmployee(DEFAULT_EMPLOYEE_NAME)];
    }

    this.applyEmployeeList(loaded);

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

    const saved = await this.persistEmployee(employee, 'insert');
    this.applyEmployeeList([...this.employees(), saved]);

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
    const saved = await this.persistEmployee(updated, 'update');
    this.applyEmployeeList(this.employees().map((employee) => (employee.id === id ? saved : employee)));

    const active = this.activeEmployee();
    if (active?.id === id) {
      this.activeEmployee.set(saved);
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
    const saved = await this.persistEmployee(archived, 'update');
    this.applyEmployeeList(this.employees().map((employee) => (employee.id === id ? saved : employee)));

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

  private applyEmployeeList(employees: Employee[]): void {
    const sorted = [...employees].sort((a, b) => a.sortOrder - b.sortOrder);
    this.employees.set(sorted);
    this.saveEmployeesLocal(sorted);
  }

  private async reconcileEmployees(remote: Employee[], local: Employee[]): Promise<Employee[]> {
    const merged = new Map<string, Employee>();

    for (const employee of remote) {
      merged.set(employee.id, employee);
    }

    for (const employee of local) {
      if (!merged.has(employee.id)) {
        merged.set(employee.id, employee);
      }
    }

    if (!isSupabaseConfigured()) {
      return Array.from(merged.values());
    }

    const synced: Employee[] = [];
    for (const employee of merged.values()) {
      const remoteVersion = remote.find((item) => item.id === employee.id);
      const mode = remoteVersion ? 'update' : 'insert';
      try {
        synced.push(await this.persistEmployee(employee, mode));
      } catch {
        synced.push(employee);
      }
    }

    return synced.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  private async persistEmployee(employee: Employee, mode: 'insert' | 'update'): Promise<Employee> {
    if (!isSupabaseConfigured()) {
      return employee;
    }

    const remote = await this.saveEmployeeRemote(employee, mode);
    if (!remote) {
      const message = 'No se pudo guardar el empleado en el servidor.';
      this.lastSyncError.set(message);
      if (this.clientIdService.isSharedWorkspace()) {
        throw new Error(message);
      }
      return employee;
    }

    this.lastSyncError.set(null);
    return remote;
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
      this.lastSyncError.set(error.message);
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
        this.lastSyncError.set(error.message);
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

  private async saveEmployeeRemote(employee: Employee, mode: 'insert' | 'update'): Promise<Employee | null> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return null;
    }

    const row = {
      id: employee.id,
      client_id: this.clientIdService.getClientId(),
      name: employee.name,
      active: employee.active,
      sort_order: employee.sortOrder,
      updated_at: new Date().toISOString(),
    };

    try {
      const query =
        mode === 'insert'
          ? supabase.from('employees').insert(row).select('id, name, active, sort_order').single()
          : supabase
              .from('employees')
              .update({
                name: row.name,
                active: row.active,
                sort_order: row.sort_order,
                updated_at: row.updated_at,
              })
              .eq('id', row.id)
              .eq('client_id', row.client_id)
              .select('id, name, active, sort_order')
              .single();

      const { data, error } = await query;

      if (error || !data) {
        if (mode === 'insert' && error?.code === '23505') {
          return this.saveEmployeeRemote(employee, 'update');
        }

        console.error('Failed to save employee', error?.message ?? error);
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
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.map((employee) => ({
        id: employee.id,
        name: employee.name,
        active: employee.active !== false,
        sortOrder: Number(employee.sortOrder ?? 0),
      }));
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
