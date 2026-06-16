import { Injectable, signal } from '@angular/core';
import { AppSettings, DEFAULT_SETTINGS } from '../models/app-settings.model';

const STORAGE_KEY = 'moms-salary-settings';

interface LegacyAppSettings extends Partial<AppSettings> {
  holidayMultiplier?: number;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly settings = signal<AppSettings>(this.loadSettings());

  update(partial: Partial<AppSettings>): void {
    const next = { ...this.settings(), ...partial };
    this.settings.set(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  private loadSettings(): AppSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { ...DEFAULT_SETTINGS };
      }

      const parsed = JSON.parse(raw) as LegacyAppSettings;
      const hourlyRate = this.toPositiveNumber(parsed.hourlyRate, DEFAULT_SETTINGS.hourlyRate);

      return {
        hourlyRate,
        defaultHoursPerDay: this.toPositiveNumber(parsed.defaultHoursPerDay, DEFAULT_SETTINGS.defaultHoursPerDay),
        holidayHourlyRate: this.resolveHolidayHourlyRate(parsed, hourlyRate),
        paymentPeriodType: parsed.paymentPeriodType === 'mensual' ? 'mensual' : 'quincenal',
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private resolveHolidayHourlyRate(parsed: LegacyAppSettings, hourlyRate: number): number {
    if (parsed.holidayHourlyRate !== undefined) {
      return this.toPositiveNumber(parsed.holidayHourlyRate, DEFAULT_SETTINGS.holidayHourlyRate);
    }

    if (parsed.holidayMultiplier !== undefined) {
      const multiplier = this.toPositiveNumber(parsed.holidayMultiplier, 2);
      return hourlyRate * multiplier;
    }

    return DEFAULT_SETTINGS.holidayHourlyRate;
  }

  private toPositiveNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
