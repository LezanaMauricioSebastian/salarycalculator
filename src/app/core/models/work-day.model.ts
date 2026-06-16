export interface WorkDay {
  date: string;
  selected: boolean;
  hours: number;
  isHoliday: boolean;
  holidayName?: string;
}

export interface SalaryBreakdown {
  regularDays: number;
  holidayDays: number;
  regularHours: number;
  holidayHours: number;
  totalHours: number;
  regularPay: number;
  holidayPay: number;
  totalPay: number;
}
