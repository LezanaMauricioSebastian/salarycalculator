import { Injectable, signal } from '@angular/core';
import { AppSettings, DEFAULT_SETTINGS } from '../models/app-settings.model';
import { PaymentPeriod, getCurrentPaymentPeriod } from '../models/payment-period.model';
import { SalaryStorageService } from './salary-storage.service';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly settings = signal<AppSettings>({ ...DEFAULT_SETTINGS });
  readonly ready = signal(false);
  readonly syncEnabled = signal(false);

  constructor(private readonly storage: SalaryStorageService) {}

  async initialize(): Promise<void> {
    this.syncEnabled.set(this.storage.isRemoteEnabled());
    const loaded = await this.storage.loadSettings();
    this.settings.set(loaded);
    this.ready.set(true);
  }

  update(partial: Partial<AppSettings>): void {
    const next = { ...this.settings(), ...partial };
    this.settings.set(next);
    void this.storage.saveSettings(next);
  }

  async getInitialPeriod(): Promise<PaymentPeriod> {
    const saved = await this.storage.loadLastPeriod();
    return saved ?? getCurrentPaymentPeriod();
  }
}
