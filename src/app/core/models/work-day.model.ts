export interface WorkDay {
  date: string;
  selected: boolean;
  hours: number;
  isHoliday: boolean;
  isWeekend: boolean;
  holidayName?: string;
}

export interface SalaryBreakdown {
  regularDays: number;
  holidayDays: number;
  weekendDays: number;
  regularHours: number;
  holidayHours: number;
  weekendHours: number;
  totalHours: number;
  regularPay: number;
  holidayPay: number;
  weekendPay: number;
  totalPay: number;
}
