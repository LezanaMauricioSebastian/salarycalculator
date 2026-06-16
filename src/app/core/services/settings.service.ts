import { Injectable, signal } from '@angular/core';
import { AppSettings, DEFAULT_SETTINGS } from '../models/app-settings.model';
import { PaymentPeriod, getCurrentPaymentPeriod } from '../models/payment-period.model';
import { EmployeeService } from './employee.service';
import { SalaryStorageService } from './salary-storage.service';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly settings = signal<AppSettings>({ ...DEFAULT_SETTINGS });
  readonly ready = signal(false);
  readonly syncEnabled = signal(false);

  constructor(
    private readonly storage: SalaryStorageService,
    private readonly employeeService: EmployeeService,
  ) {}

  async initialize(): Promise<void> {
    this.syncEnabled.set(this.storage.isRemoteEnabled());
    await this.employeeService.initialize();
    await this.loadActiveEmployeeSettings();
    this.ready.set(true);
  }

  async reloadForActiveEmployee(): Promise<void> {
    await this.loadActiveEmployeeSettings();
  }

  update(partial: Partial<AppSettings>): void {
    const employee = this.employeeService.activeEmployee();
    if (!employee) {
      return;
    }

    const next = { ...this.settings(), ...partial };
    this.settings.set(next);
    void this.storage.saveSettings(employee.id, next);
  }

  async getInitialPeriod(): Promise<PaymentPeriod> {
    const employee = this.employeeService.activeEmployee();
    if (!employee) {
      return getCurrentPaymentPeriod();
    }

    const saved = await this.storage.loadLastPeriod(employee.id);
    return saved ?? getCurrentPaymentPeriod();
  }

  private async loadActiveEmployeeSettings(): Promise<void> {
    const employee = this.employeeService.activeEmployee();
    if (!employee) {
      this.settings.set({ ...DEFAULT_SETTINGS });
      return;
    }

    const loaded = await this.storage.loadSettings(employee.id);
    this.settings.set(loaded);
  }
}
