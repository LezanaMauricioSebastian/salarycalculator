import { Injectable } from '@angular/core';
import { AppSettings } from '../models/app-settings.model';
import { SalaryBreakdown, WorkDay } from '../models/work-day.model';

@Injectable({ providedIn: 'root' })
export class SalaryService {
  calculate(workDays: WorkDay[], settings: AppSettings): SalaryBreakdown {
    const selectedDays = workDays.filter((day) => day.selected);

    let regularDays = 0;
    let holidayDays = 0;
    let regularHours = 0;
    let holidayHours = 0;

    for (const day of selectedDays) {
      if (day.isHoliday) {
        holidayDays += 1;
        holidayHours += day.hours;
      } else {
        regularDays += 1;
        regularHours += day.hours;
      }
    }

    const regularPay = regularHours * settings.hourlyRate;
    const holidayPay = holidayHours * settings.holidayHourlyRate;

    return {
      regularDays,
      holidayDays,
      regularHours,
      holidayHours,
      totalHours: regularHours + holidayHours,
      regularPay,
      holidayPay,
      totalPay: regularPay + holidayPay,
    };
  }
}
