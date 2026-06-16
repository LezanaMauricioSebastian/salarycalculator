import { endOfMonth } from 'date-fns';

export type PaymentPeriodType = 'quincenal' | 'mensual';
export type Quincena = 'primera' | 'segunda';

export interface PaymentPeriod {
  year: number;
  month: number;
  quincena: Quincena;
}

export function getCurrentPaymentPeriod(): PaymentPeriod {
  const now = new Date();

  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    quincena: now.getDate() <= 15 ? 'primera' : 'segunda',
  };
}

export function getQuincenaRange(year: number, month: number, quincena: Quincena): { start: Date; end: Date } {
  const monthStart = new Date(year, month, 1);
  const monthEnd = endOfMonth(monthStart);

  if (quincena === 'primera') {
    return { start: monthStart, end: new Date(year, month, 15) };
  }

  return { start: new Date(year, month, 16), end: monthEnd };
}

export function shiftPaymentPeriod(period: PaymentPeriod, delta: number): PaymentPeriod {
  let { year, month, quincena } = period;

  for (let step = 0; step < Math.abs(delta); step += 1) {
    if (delta > 0) {
      if (quincena === 'primera') {
        quincena = 'segunda';
      } else {
        quincena = 'primera';
        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }
      }
    } else if (quincena === 'segunda') {
      quincena = 'primera';
    } else {
      quincena = 'segunda';
      month -= 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
    }
  }

  return { year, month, quincena };
}
