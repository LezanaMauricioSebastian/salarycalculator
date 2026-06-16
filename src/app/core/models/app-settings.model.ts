import { PaymentPeriodType } from './payment-period.model';

export interface AppSettings {
  hourlyRate: number;
  defaultHoursPerDay: number;
  holidayHourlyRate: number;
  weekendHourlyRate: number;
  paymentPeriodType: PaymentPeriodType;
}

export const DEFAULT_SETTINGS: AppSettings = {
  hourlyRate: 4000,
  defaultHoursPerDay: 8,
  holidayHourlyRate: 4800,
  weekendHourlyRate: 4800,
  paymentPeriodType: 'quincenal',
};
