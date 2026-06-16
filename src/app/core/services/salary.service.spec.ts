import { DEFAULT_SETTINGS } from '../models/app-settings.model';
import { WorkDay } from '../models/work-day.model';
import { SalaryService } from './salary.service';

describe('SalaryService', () => {
  const service = new SalaryService();

  it('calculates regular and holiday pay with holiday hourly rate', () => {
    const workDays: WorkDay[] = [
      {
        date: '2025-06-02',
        selected: true,
        hours: 8,
        isHoliday: false,
        isWeekend: false,
      },
      {
        date: '2025-06-20',
        selected: true,
        hours: 8,
        isHoliday: true,
        isWeekend: false,
        holidayName: 'Belgrano',
      },
    ];

    const breakdown = service.calculate(workDays, {
      ...DEFAULT_SETTINGS,
      hourlyRate: 1000,
      holidayHourlyRate: 2000,
      weekendHourlyRate: 1500,
    });

    expect(breakdown.regularDays).toBe(1);
    expect(breakdown.holidayDays).toBe(1);
    expect(breakdown.regularPay).toBe(8000);
    expect(breakdown.holidayPay).toBe(16000);
    expect(breakdown.totalPay).toBe(24000);
  });

  it('calculates weekend pay for saturday and sunday', () => {
    const workDays: WorkDay[] = [
      {
        date: '2025-06-07',
        selected: true,
        hours: 8,
        isHoliday: false,
        isWeekend: true,
      },
      {
        date: '2025-06-08',
        selected: true,
        hours: 4,
        isHoliday: false,
        isWeekend: true,
      },
    ];

    const breakdown = service.calculate(workDays, {
      ...DEFAULT_SETTINGS,
      hourlyRate: 1000,
      weekendHourlyRate: 1500,
    });

    expect(breakdown.weekendDays).toBe(2);
    expect(breakdown.weekendHours).toBe(12);
    expect(breakdown.weekendPay).toBe(18000);
    expect(breakdown.totalPay).toBe(18000);
  });

  it('uses holiday rate when a weekend day is also a holiday', () => {
    const workDays: WorkDay[] = [
      {
        date: '2025-06-07',
        selected: true,
        hours: 8,
        isHoliday: true,
        isWeekend: true,
        holidayName: 'Feriado',
      },
    ];

    const breakdown = service.calculate(workDays, {
      ...DEFAULT_SETTINGS,
      hourlyRate: 1000,
      holidayHourlyRate: 2000,
      weekendHourlyRate: 1500,
    });

    expect(breakdown.holidayDays).toBe(1);
    expect(breakdown.weekendDays).toBe(0);
    expect(breakdown.holidayPay).toBe(16000);
  });

  it('ignores unselected days', () => {
    const workDays: WorkDay[] = [
      {
        date: '2025-06-02',
        selected: false,
        hours: 8,
        isHoliday: false,
        isWeekend: false,
      },
    ];

    const breakdown = service.calculate(workDays, DEFAULT_SETTINGS);
    expect(breakdown.totalPay).toBe(0);
    expect(breakdown.totalHours).toBe(0);
  });
});
