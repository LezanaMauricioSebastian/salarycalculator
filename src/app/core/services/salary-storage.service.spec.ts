import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS } from '../models/app-settings.model';
import { ClientIdService } from './client-id.service';
import { SalaryStorageService } from './salary-storage.service';

describe('SalaryStorageService', () => {
  let service: SalaryStorageService;
  const employeeId = 'employee-1';

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        SalaryStorageService,
        {
          provide: ClientIdService,
          useValue: {
            getClientId: () => 'test-client-id',
            isSharedWorkspace: () => false,
          },
        },
      ],
    });

    service = TestBed.inject(SalaryStorageService);
  });

  it('stores settings per employee in localStorage', async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      hourlyRate: 5000,
    };

    await service.saveSettings(employeeId, settings);
    const loaded = await service.loadSettings(employeeId);

    expect(loaded.hourlyRate).toBe(5000);
  });

  it('migrates legacy global settings to the first employee', async () => {
    localStorage.setItem(
      'moms-salary-settings',
      JSON.stringify({
        hourlyRate: 4500,
        defaultHoursPerDay: 7,
        holidayHourlyRate: 5400,
        paymentPeriodType: 'mensual',
      }),
    );

    const migrated = service.migrateLegacySettings(employeeId);
    const loaded = await service.loadSettings(employeeId);

    expect(migrated?.hourlyRate).toBe(4500);
    expect(loaded.paymentPeriodType).toBe('mensual');
    expect(loaded.defaultHoursPerDay).toBe(7);
  });

  it('stores work days per employee in localStorage', async () => {
    const period = { year: 2025, month: 5, quincena: 'primera' as const };
    const workDays = [
      { date: '2025-06-02', selected: true, hours: 8, isHoliday: false, isWeekend: false },
      { date: '2025-06-03', selected: false, hours: 8, isHoliday: false, isWeekend: false },
    ];

    await service.savePeriodState(employeeId, period, 'quincenal', workDays, 8);

    const loaded = await service.loadPeriodState(employeeId, period, 'quincenal', 8);

    expect(loaded?.workDays.length).toBe(2);
    expect(loaded?.workDays[0].selected).toBeTrue();
    expect(loaded?.workDays[1].selected).toBeFalse();
  });

  it('clears false hour overrides when default hours changed after save', async () => {
    const period = { year: 2025, month: 5, quincena: 'segunda' as const };
    const workDays = [
      { date: '2025-06-16', selected: true, hours: 8, isHoliday: false, isWeekend: false },
      { date: '2025-06-17', selected: true, hours: 8, isHoliday: false, isWeekend: false },
    ];

    await service.savePeriodState(employeeId, period, 'quincenal', workDays, 8);

    const loaded = await service.loadPeriodState(employeeId, period, 'quincenal', 9);

    expect(loaded?.customHoursByDate).toEqual({});
    expect(loaded?.defaultHoursPerDay).toBe(8);
  });

  it('keeps true per-day overrides when default hours changed after save', async () => {
    const period = { year: 2025, month: 5, quincena: 'segunda' as const };
    const workDays = [
      { date: '2025-06-16', selected: true, hours: 9, isHoliday: false, isWeekend: false },
      { date: '2025-06-17', selected: true, hours: 6, isHoliday: false, isWeekend: false },
    ];

    await service.savePeriodState(employeeId, period, 'quincenal', workDays, 9);

    const loaded = await service.loadPeriodState(employeeId, period, 'quincenal', 9);

    expect(loaded?.customHoursByDate).toEqual({ '2025-06-17': 6 });
  });
});
