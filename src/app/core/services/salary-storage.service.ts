import { Injectable } from '@angular/core';
import { AppSettings, DEFAULT_SETTINGS } from '../models/app-settings.model';
import { PaymentPeriod, PaymentPeriodType, Quincena } from '../models/payment-period.model';
import { WorkDay } from '../models/work-day.model';
import { getSupabaseClient, isSupabaseConfigured } from '../supabase/supabase.client';
import { ClientIdService } from './client-id.service';

const LEGACY_LOCAL_SETTINGS_KEY = 'moms-salary-settings';

type StoredQuincena = Quincena | 'full';

interface LegacyAppSettings extends Partial<AppSettings> {
  holidayMultiplier?: number;
}

export interface StoredPeriodState {
  defaultHoursPerDay?: number;
  customHoursByDate: Record<string, number>;
  workDays: Array<Pick<WorkDay, 'date' | 'selected' | 'hours'>>;
}

interface EmployeeSettingsRow {
  hourly_rate: number;
  default_hours_per_day: number;
  holiday_hourly_rate: number;
  weekend_hourly_rate?: number | null;
  payment_period_type: PaymentPeriodType;
  last_year?: number | null;
  last_month?: number | null;
  last_quincena?: Quincena | null;
}

@Injectable({ providedIn: 'root' })
export class SalaryStorageService {
  constructor(private readonly clientIdService: ClientIdService) {}

  isRemoteEnabled(): boolean {
    return isSupabaseConfigured();
  }

  async loadSettings(employeeId: string): Promise<AppSettings> {
    const localSettings = this.loadLocalSettings(employeeId);

    if (!isSupabaseConfigured()) {
      return localSettings;
    }

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return localSettings;
      }

      const { data, error } = await supabase
        .from('employee_settings')
        .select('hourly_rate, default_hours_per_day, holiday_hourly_rate, weekend_hourly_rate, payment_period_type')
        .eq('employee_id', employeeId)
        .maybeSingle();

      if (error || !data) {
        await this.saveSettings(employeeId, localSettings);
        return localSettings;
      }

      const remoteSettings = this.mapSettingsRow(data);
      this.saveLocalSettings(employeeId, remoteSettings);
      return remoteSettings;
    } catch {
      return localSettings;
    }
  }

  async saveSettings(employeeId: string, settings: AppSettings): Promise<void> {
    this.saveLocalSettings(employeeId, settings);

    if (!isSupabaseConfigured()) {
      return;
    }

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return;
      }

      await supabase.from('employee_settings').upsert(
        {
          employee_id: employeeId,
          hourly_rate: settings.hourlyRate,
          default_hours_per_day: settings.defaultHoursPerDay,
          holiday_hourly_rate: settings.holidayHourlyRate,
          weekend_hourly_rate: settings.weekendHourlyRate,
          payment_period_type: settings.paymentPeriodType,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'employee_id' },
      );
    } catch {
      // localStorage already saved
    }
  }

  async loadLastPeriod(employeeId: string): Promise<PaymentPeriod | null> {
    const local = this.loadLocalLastPeriod(employeeId);

    if (!isSupabaseConfigured()) {
      return local;
    }

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return local;
      }

      const { data, error } = await supabase
        .from('employee_settings')
        .select('last_year, last_month, last_quincena')
        .eq('employee_id', employeeId)
        .maybeSingle();

      if (error || !data || data.last_year === null || data.last_month === null) {
        return local;
      }

      const remote: PaymentPeriod = {
        year: data.last_year,
        month: data.last_month,
        quincena: (data.last_quincena as Quincena | null) ?? 'primera',
      };
      this.saveLocalLastPeriod(employeeId, remote);
      return remote;
    } catch {
      return local;
    }
  }

  async loadPeriodState(
    employeeId: string,
    period: PaymentPeriod,
    periodType: PaymentPeriodType,
    defaultHoursPerDay: number,
  ): Promise<StoredPeriodState | null> {
    const local = this.loadLocalPeriodState(employeeId, period, periodType);

    if (!isSupabaseConfigured()) {
      return local ? this.normalizeStoredPeriodState(local, defaultHoursPerDay) : null;
    }

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return local ? this.normalizeStoredPeriodState(local, defaultHoursPerDay) : null;
      }

      const { data: periodRow, error: periodError } = await supabase
        .from('work_periods')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('year', period.year)
        .eq('month', period.month)
        .eq('quincena', this.periodQuincenaValue(period, periodType))
        .eq('period_type', periodType)
        .maybeSingle();

      if (periodError || !periodRow) {
        return local ? this.normalizeStoredPeriodState(local, defaultHoursPerDay) : null;
      }

      const { data: entries, error: entriesError } = await supabase
        .from('work_day_entries')
        .select('work_date, selected, hours')
        .eq('period_id', periodRow.id);

      if (entriesError || !entries) {
        return local ? this.normalizeStoredPeriodState(local, defaultHoursPerDay) : null;
      }

      const remote = this.normalizeStoredPeriodState(
        this.mapPeriodEntries(entries, defaultHoursPerDay),
        defaultHoursPerDay,
      );
      this.saveLocalPeriodState(employeeId, period, periodType, remote);
      return remote;
    } catch {
      return local ? this.normalizeStoredPeriodState(local, defaultHoursPerDay) : null;
    }
  }

  async savePeriodState(
    employeeId: string,
    period: PaymentPeriod,
    periodType: PaymentPeriodType,
    workDays: WorkDay[],
    defaultHoursPerDay: number,
  ): Promise<void> {
    const realDays = workDays.filter((day) => day.date);
    if (realDays.length === 0) {
      return;
    }

    const stored = this.buildStoredPeriodState(realDays, defaultHoursPerDay);
    this.saveLocalPeriodState(employeeId, period, periodType, stored);
    this.saveLocalLastPeriod(employeeId, period);

    if (!isSupabaseConfigured()) {
      return;
    }

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return;
      }

      const { data: periodRow, error: periodError } = await supabase
        .from('work_periods')
        .upsert(
          {
            client_id: this.clientIdService.getClientId(),
            employee_id: employeeId,
            year: period.year,
            month: period.month,
            quincena: this.periodQuincenaValue(period, periodType),
            period_type: periodType,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'employee_id,year,month,quincena,period_type' },
        )
        .select('id')
        .single();

      if (periodError || !periodRow) {
        return;
      }

      const entries = realDays.map((day) => ({
        period_id: periodRow.id,
        work_date: day.date,
        selected: day.selected,
        hours: day.hours,
      }));

      await supabase.from('work_day_entries').delete().eq('period_id', periodRow.id);
      await supabase.from('work_day_entries').insert(entries);

      await supabase
        .from('employee_settings')
        .update({
          last_year: period.year,
          last_month: period.month,
          last_quincena: periodType === 'quincenal' ? period.quincena : null,
          updated_at: new Date().toISOString(),
        })
        .eq('employee_id', employeeId);
    } catch {
      // ignore
    }
  }

  migrateLegacySettings(employeeId: string): AppSettings | null {
    try {
      const raw = localStorage.getItem(LEGACY_LOCAL_SETTINGS_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as LegacyAppSettings;
      const hourlyRate = this.toPositiveNumber(parsed.hourlyRate, DEFAULT_SETTINGS.hourlyRate);
      const settings: AppSettings = {
        hourlyRate,
        defaultHoursPerDay: this.toPositiveNumber(parsed.defaultHoursPerDay, DEFAULT_SETTINGS.defaultHoursPerDay),
        holidayHourlyRate: this.resolveHolidayHourlyRate(parsed, hourlyRate),
        weekendHourlyRate: this.resolveWeekendHourlyRate(parsed, hourlyRate),
        paymentPeriodType: parsed.paymentPeriodType === 'mensual' ? 'mensual' : 'quincenal',
      };

      this.saveLocalSettings(employeeId, settings);
      return settings;
    } catch {
      return null;
    }
  }

  private localSettingsKey(employeeId: string): string {
    return `moms-employee-settings:${employeeId}`;
  }

  private localPeriodKey(
    employeeId: string,
    period: PaymentPeriod,
    periodType: PaymentPeriodType,
  ): string {
    const quincena = this.periodQuincenaValue(period, periodType);
    return `moms-employee-period:${employeeId}:${period.year}:${period.month}:${quincena}:${periodType}`;
  }

  private localLastPeriodKey(employeeId: string): string {
    return `moms-employee-last-period:${employeeId}`;
  }

  private loadLocalPeriodState(
    employeeId: string,
    period: PaymentPeriod,
    periodType: PaymentPeriodType,
  ): StoredPeriodState | null {
    try {
      const raw = localStorage.getItem(this.localPeriodKey(employeeId, period, periodType));
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as StoredPeriodState;
      if (!parsed?.workDays || !Array.isArray(parsed.workDays)) {
        return null;
      }

      return {
        defaultHoursPerDay: parsed.defaultHoursPerDay,
        customHoursByDate: parsed.customHoursByDate ?? {},
        workDays: parsed.workDays,
      };
    } catch {
      return null;
    }
  }

  private saveLocalPeriodState(
    employeeId: string,
    period: PaymentPeriod,
    periodType: PaymentPeriodType,
    state: StoredPeriodState,
  ): void {
    localStorage.setItem(this.localPeriodKey(employeeId, period, periodType), JSON.stringify(state));
  }

  private loadLocalLastPeriod(employeeId: string): PaymentPeriod | null {
    try {
      const raw = localStorage.getItem(this.localLastPeriodKey(employeeId));
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as PaymentPeriod;
      if (
        typeof parsed.year !== 'number' ||
        typeof parsed.month !== 'number' ||
        !parsed.quincena
      ) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  private saveLocalLastPeriod(employeeId: string, period: PaymentPeriod): void {
    localStorage.setItem(this.localLastPeriodKey(employeeId), JSON.stringify(period));
  }

  private buildStoredPeriodState(workDays: WorkDay[], defaultHoursPerDay: number): StoredPeriodState {
    const customHoursByDate: Record<string, number> = {};
    const days = workDays.map((day) => {
      if (day.date && day.hours !== defaultHoursPerDay) {
        customHoursByDate[day.date] = day.hours;
      }

      return {
        date: day.date,
        selected: day.selected,
        hours: day.hours,
      };
    });

    return { defaultHoursPerDay, customHoursByDate, workDays: days };
  }

  private normalizeStoredPeriodState(
    stored: StoredPeriodState,
    currentDefaultHoursPerDay: number,
  ): StoredPeriodState {
    const savedDefault = stored.defaultHoursPerDay;

    if (savedDefault !== undefined) {
      const customHoursByDate: Record<string, number> = {};
      for (const day of stored.workDays) {
        if (day.date && day.hours !== savedDefault) {
          customHoursByDate[day.date] = day.hours;
        }
      }

      return { ...stored, customHoursByDate };
    }

    const realDays = stored.workDays.filter((day) => day.date);
    const overrideKeys = Object.keys(stored.customHoursByDate);

    if (
      realDays.length > 0 &&
      overrideKeys.length === realDays.length &&
      realDays.every((day) => stored.customHoursByDate[day.date] === day.hours)
    ) {
      const uniqueHours = new Set(realDays.map((day) => day.hours));
      if (uniqueHours.size === 1) {
        const [onlyHours] = uniqueHours;
        if (onlyHours !== currentDefaultHoursPerDay) {
          return { ...stored, customHoursByDate: {} };
        }
      }
    }

    return stored;
  }

  private mapPeriodEntries(
    entries: Array<{ work_date: string; selected: boolean; hours: number }>,
    defaultHoursPerDay: number,
  ): StoredPeriodState {
    const customHoursByDate: Record<string, number> = {};
    const workDays = entries.map((entry) => {
      const date = entry.work_date as string;
      const hours = Number(entry.hours);

      if (hours !== defaultHoursPerDay) {
        customHoursByDate[date] = hours;
      }

      return {
        date,
        selected: Boolean(entry.selected),
        hours,
      };
    });

    return { customHoursByDate, workDays };
  }

  private periodQuincenaValue(period: PaymentPeriod, periodType: PaymentPeriodType): StoredQuincena {
    return periodType === 'quincenal' ? period.quincena : 'full';
  }

  private loadLocalSettings(employeeId: string): AppSettings {
    try {
      const raw = localStorage.getItem(this.localSettingsKey(employeeId));
      if (!raw) {
        return this.migrateLegacySettings(employeeId) ?? { ...DEFAULT_SETTINGS };
      }

      const parsed = JSON.parse(raw) as LegacyAppSettings;
      const hourlyRate = this.toPositiveNumber(parsed.hourlyRate, DEFAULT_SETTINGS.hourlyRate);

      return {
        hourlyRate,
        defaultHoursPerDay: this.toPositiveNumber(parsed.defaultHoursPerDay, DEFAULT_SETTINGS.defaultHoursPerDay),
        holidayHourlyRate: this.resolveHolidayHourlyRate(parsed, hourlyRate),
        weekendHourlyRate: this.resolveWeekendHourlyRate(parsed, hourlyRate),
        paymentPeriodType: parsed.paymentPeriodType === 'mensual' ? 'mensual' : 'quincenal',
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private saveLocalSettings(employeeId: string, settings: AppSettings): void {
    localStorage.setItem(this.localSettingsKey(employeeId), JSON.stringify(settings));
  }

  private mapSettingsRow(row: EmployeeSettingsRow): AppSettings {
    const hourlyRate = this.toPositiveNumber(row.hourly_rate, DEFAULT_SETTINGS.hourlyRate);

    return {
      hourlyRate,
      defaultHoursPerDay: this.toPositiveNumber(row.default_hours_per_day, DEFAULT_SETTINGS.defaultHoursPerDay),
      holidayHourlyRate: this.toPositiveNumber(row.holiday_hourly_rate, DEFAULT_SETTINGS.holidayHourlyRate),
      weekendHourlyRate: this.toPositiveNumber(
        row.weekend_hourly_rate,
        this.resolveWeekendHourlyRate({}, hourlyRate),
      ),
      paymentPeriodType: row.payment_period_type === 'mensual' ? 'mensual' : 'quincenal',
    };
  }

  private resolveWeekendHourlyRate(parsed: LegacyAppSettings, hourlyRate: number): number {
    if (parsed.weekendHourlyRate !== undefined) {
      return this.toPositiveNumber(parsed.weekendHourlyRate, DEFAULT_SETTINGS.weekendHourlyRate);
    }

    if (parsed.holidayHourlyRate !== undefined) {
      return this.toPositiveNumber(parsed.holidayHourlyRate, DEFAULT_SETTINGS.weekendHourlyRate);
    }

    return DEFAULT_SETTINGS.weekendHourlyRate;
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
