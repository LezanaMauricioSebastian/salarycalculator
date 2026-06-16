import { Injectable } from '@angular/core';
import { AppSettings, DEFAULT_SETTINGS } from '../models/app-settings.model';
import { PaymentPeriod, PaymentPeriodType, Quincena } from '../models/payment-period.model';
import { WorkDay } from '../models/work-day.model';
import { getSupabaseClient, isSupabaseConfigured } from '../supabase/supabase.client';
import { ClientIdService } from './client-id.service';

const LOCAL_SETTINGS_KEY = 'moms-salary-settings';

type StoredQuincena = Quincena | 'full';

interface LegacyAppSettings extends Partial<AppSettings> {
  holidayMultiplier?: number;
}

export interface StoredPeriodState {
  customHoursByDate: Record<string, number>;
  workDays: Array<Pick<WorkDay, 'date' | 'selected' | 'hours'>>;
}

interface SalarySettingsRow {
  hourly_rate: number;
  default_hours_per_day: number;
  holiday_hourly_rate: number;
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

  async loadSettings(): Promise<AppSettings> {
    const localSettings = this.loadLocalSettings();

    if (!isSupabaseConfigured()) {
      return localSettings;
    }

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return localSettings;
      }

      const { data, error } = await supabase
        .from('salary_settings')
        .select('hourly_rate, default_hours_per_day, holiday_hourly_rate, payment_period_type')
        .eq('client_id', this.clientIdService.getClientId())
        .maybeSingle();

      if (error || !data) {
        await this.saveSettings(localSettings);
        return localSettings;
      }

      const remoteSettings = this.mapSettingsRow(data);
      this.saveLocalSettings(remoteSettings);
      return remoteSettings;
    } catch {
      return localSettings;
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    this.saveLocalSettings(settings);

    if (!isSupabaseConfigured()) {
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
          hourly_rate: settings.hourlyRate,
          default_hours_per_day: settings.defaultHoursPerDay,
          holiday_hourly_rate: settings.holidayHourlyRate,
          payment_period_type: settings.paymentPeriodType,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'client_id' },
      );
    } catch {
      // localStorage already saved
    }
  }

  async loadLastPeriod(): Promise<PaymentPeriod | null> {
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
        .select('last_year, last_month, last_quincena')
        .eq('client_id', this.clientIdService.getClientId())
        .maybeSingle();

      if (error || !data || data.last_year === null || data.last_month === null) {
        return null;
      }

      return {
        year: data.last_year,
        month: data.last_month,
        quincena: (data.last_quincena as Quincena | null) ?? 'primera',
      };
    } catch {
      return null;
    }
  }

  async loadPeriodState(
    period: PaymentPeriod,
    periodType: PaymentPeriodType,
    defaultHoursPerDay: number,
  ): Promise<StoredPeriodState | null> {
    if (!isSupabaseConfigured()) {
      return null;
    }

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return null;
      }

      const { data: periodRow, error: periodError } = await supabase
        .from('work_periods')
        .select('id')
        .eq('client_id', this.clientIdService.getClientId())
        .eq('year', period.year)
        .eq('month', period.month)
        .eq('quincena', this.periodQuincenaValue(period, periodType))
        .eq('period_type', periodType)
        .maybeSingle();

      if (periodError || !periodRow) {
        return null;
      }

      const { data: entries, error: entriesError } = await supabase
        .from('work_day_entries')
        .select('work_date, selected, hours')
        .eq('period_id', periodRow.id);

      if (entriesError || !entries) {
        return null;
      }

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
    } catch {
      return null;
    }
  }

  async savePeriodState(
    period: PaymentPeriod,
    periodType: PaymentPeriodType,
    workDays: WorkDay[],
  ): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }

    const realDays = workDays.filter((day) => day.date);
    if (realDays.length === 0) {
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
            year: period.year,
            month: period.month,
            quincena: this.periodQuincenaValue(period, periodType),
            period_type: periodType,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'client_id,year,month,quincena,period_type' },
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

      await supabase.from('salary_settings').upsert(
        {
          client_id: this.clientIdService.getClientId(),
          last_year: period.year,
          last_month: period.month,
          last_quincena: periodType === 'quincenal' ? period.quincena : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'client_id' },
      );
    } catch {
      // ignore
    }
  }

  private periodQuincenaValue(period: PaymentPeriod, periodType: PaymentPeriodType): StoredQuincena {
    return periodType === 'quincenal' ? period.quincena : 'full';
  }

  private loadLocalSettings(): AppSettings {
    try {
      const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
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

  private saveLocalSettings(settings: AppSettings): void {
    localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
  }

  private mapSettingsRow(row: SalarySettingsRow): AppSettings {
    return {
      hourlyRate: this.toPositiveNumber(row.hourly_rate, DEFAULT_SETTINGS.hourlyRate),
      defaultHoursPerDay: this.toPositiveNumber(row.default_hours_per_day, DEFAULT_SETTINGS.defaultHoursPerDay),
      holidayHourlyRate: this.toPositiveNumber(row.holiday_hourly_rate, DEFAULT_SETTINGS.holidayHourlyRate),
      paymentPeriodType: row.payment_period_type === 'mensual' ? 'mensual' : 'quincenal',
    };
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
