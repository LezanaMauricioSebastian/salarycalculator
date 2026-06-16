import { Injectable, signal } from '@angular/core';
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
      loaded = this.loadEmployeesLocal();
    }

    if (loaded.length === 0) {
      const created = await this.createEmployee(DEFAULT_EMPLOYEE_NAME);
      loaded = [created];
    }

    this.employees.set(loaded.sort((a, b) => a.sortOrder - b.sortOrder));

    const activeId = (await this.loadActiveEmployeeIdRemote()) ?? this.loadActiveEmployeeIdLocal();
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

    const sortOrder = this.employees().length;
    const employee: Employee = {
      id: crypto.randomUUID(),
      name: trimmed,
      active: true,
      sortOrder,
    };

    if (isSupabaseConfigured()) {
      const remote = await this.insertEmployeeRemote(employee);
      if (remote) {
        employee.id = remote.id;
      }
    }

    this.employees.update((list) => [...list, employee].sort((a, b) => a.sortOrder - b.sortOrder));
    this.saveEmployeesLocal(this.employees());

    if (!this.activeEmployee()) {
      this.activeEmployee.set(employee);
      await this.persistActiveEmployee(employee.id);
    }

    return employee;
  }

  async renameEmployee(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    this.employees.update((list) =>
      list.map((employee) => (employee.id === id ? { ...employee, name: trimmed } : employee)),
    );
    this.saveEmployeesLocal(this.employees());

    const active = this.activeEmployee();
    if (active?.id === id) {
      this.activeEmployee.set({ ...active, name: trimmed });
    }

    await this.updateEmployeeRemote(id, { name: trimmed });
  }

  async archiveEmployee(id: string): Promise<void> {
    const activeList = this.activeEmployees();
    if (activeList.length <= 1 && activeList.some((employee) => employee.id === id)) {
      return;
    }

    this.employees.update((list) =>
      list.map((employee) => (employee.id === id ? { ...employee, active: false } : employee)),
    );
    this.saveEmployeesLocal(this.employees());
    await this.updateEmployeeRemote(id, { active: false });

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

  private async persistActiveEmployee(id: string | null): Promise<void> {
    if (id) {
      localStorage.setItem(LOCAL_ACTIVE_EMPLOYEE_KEY, id);
    } else {
      localStorage.removeItem(LOCAL_ACTIVE_EMPLOYEE_KEY);
    }

    if (!isSupabaseConfigured() || !id) {
      return;
    }

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return;
      }

      await supabase.from('salary_settings').upsert(
        {
          client_id: this.clientIdService.getClientId(),
          active_employee_id: id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'client_id' },
      );
    } catch {
      // localStorage already saved
    }
  }

  private async loadEmployeesRemote(): Promise<Employee[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return [];
      }

      const { data, error } = await supabase
        .from('employees')
        .select('id, name, active, sort_order')
        .eq('client_id', this.clientIdService.getClientId())
        .order('sort_order', { ascending: true });

      if (error || !data) {
        return [];
      }

      const employees = data.map((row) => this.mapEmployeeRow(row as EmployeeRow));
      this.saveEmployeesLocal(employees);
      return employees;
    } catch {
      return [];
    }
  }

  private async insertEmployeeRemote(employee: Employee): Promise<Employee | null> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return null;
      }

      const { data, error } = await supabase
        .from('employees')
        .insert({
          id: employee.id,
          client_id: this.clientIdService.getClientId(),
          name: employee.name,
          active: employee.active,
          sort_order: employee.sortOrder,
          updated_at: new Date().toISOString(),
        })
        .select('id, name, active, sort_order')
        .single();

      if (error || !data) {
        return null;
      }

      await supabase.from('employee_settings').insert({ employee_id: data.id });
      return this.mapEmployeeRow(data as EmployeeRow);
    } catch {
      return null;
    }
  }

  private async updateEmployeeRemote(
    id: string,
    patch: Partial<Pick<Employee, 'name' | 'active'>>,
  ): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return;
      }

      await supabase
        .from('employees')
        .update({
          ...patch,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('client_id', this.clientIdService.getClientId());
    } catch {
      // ignore
    }
  }

  private async loadActiveEmployeeIdRemote(): Promise<string | null> {
    if (!isSupabaseConfigured()) {
      return null;
    }

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return null;
      }

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
