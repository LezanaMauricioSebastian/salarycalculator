import { Injectable } from '@angular/core';
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  startOfMonth,
} from 'date-fns';
import { getArgentinaHolidayMap } from '../holidays/argentina-holidays';
import { getQuincenaRange, Quincena } from '../models/payment-period.model';
import { WorkDay } from '../models/work-day.model';

function isWeekdayDate(date: Date): boolean {
  const day = getDay(date);
  return day >= 1 && day <= 5;
}

function isWeekendDate(date: Date): boolean {
  const day = getDay(date);
  return day === 0 || day === 6;
}

@Injectable({ providedIn: 'root' })
export class WorkDayService {
  buildMonth(year: number, month: number, defaultHoursPerDay: number): WorkDay[] {
    const monthStart = startOfMonth(new Date(year, month, 1));
    const monthEnd = endOfMonth(monthStart);

    return this.buildRange(monthStart, monthEnd, year, defaultHoursPerDay);
  }

  buildQuincena(
    year: number,
    month: number,
    quincena: Quincena,
    defaultHoursPerDay: number,
  ): WorkDay[] {
    const { start, end } = getQuincenaRange(year, month, quincena);

    return this.buildRange(start, end, year, defaultHoursPerDay);
  }

  private buildRange(start: Date, end: Date, year: number, defaultHoursPerDay: number): WorkDay[] {
    const holidayMap = getArgentinaHolidayMap(year);
    const leadingEmptyCells = (getDay(start) + 6) % 7;
    const days: WorkDay[] = [];

    for (let i = 0; i < leadingEmptyCells; i += 1) {
      days.push(this.createPaddingDay(defaultHoursPerDay));
    }

    for (const date of eachDayOfInterval({ start, end })) {
      const isoDate = format(date, 'yyyy-MM-dd');
      const holidayName = holidayMap.get(isoDate);

      days.push({
        date: isoDate,
        selected: isWeekdayDate(date),
        hours: defaultHoursPerDay,
        isHoliday: Boolean(holidayName),
        isWeekend: isWeekendDate(date),
        holidayName,
      });
    }

    return days;
  }

  private createPaddingDay(defaultHoursPerDay: number): WorkDay {
    return {
      date: '',
      selected: false,
      hours: defaultHoursPerDay,
      isHoliday: false,
      isWeekend: false,
    };
  }
}
