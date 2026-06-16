import { Injectable } from '@angular/core';
import { getDay, parseISO } from 'date-fns';
import { AppSettings } from '../models/app-settings.model';
import { SalaryBreakdown, WorkDay } from '../models/work-day.model';

@Injectable({ providedIn: 'root' })
export class SalaryService {
  calculate(workDays: WorkDay[], settings: AppSettings): SalaryBreakdown {
    const selectedDays = workDays.filter((day) => day.selected);

    let regularDays = 0;
    let holidayDays = 0;
    let weekendDays = 0;
    let regularHours = 0;
    let holidayHours = 0;
    let weekendHours = 0;

    for (const day of selectedDays) {
      if (day.isHoliday) {
        holidayDays += 1;
        holidayHours += day.hours;
      } else if (this.isWeekendDay(day)) {
        weekendDays += 1;
        weekendHours += day.hours;
      } else {
        regularDays += 1;
        regularHours += day.hours;
      }
    }

    const regularPay = regularHours * settings.hourlyRate;
    const holidayPay = holidayHours * settings.holidayHourlyRate;
    const weekendPay = weekendHours * settings.weekendHourlyRate;

    return {
      regularDays,
      holidayDays,
      weekendDays,
      regularHours,
      holidayHours,
      weekendHours,
      totalHours: regularHours + holidayHours + weekendHours,
      regularPay,
      holidayPay,
      weekendPay,
      totalPay: regularPay + holidayPay + weekendPay,
    };
  }

  private isWeekendDay(day: WorkDay): boolean {
    if (day.isWeekend) {
      return true;
    }

    if (!day.date) {
      return false;
    }

    const weekday = getDay(parseISO(day.date));
    return weekday === 0 || weekday === 6;
  }
}
