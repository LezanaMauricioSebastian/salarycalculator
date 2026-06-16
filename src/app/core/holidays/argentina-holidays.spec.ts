import { getArgentinaHolidays } from './argentina-holidays';

describe('Argentina holidays', () => {
  it('includes shifted Güemes and Belgrano in June 2025', () => {
    const holidays = getArgentinaHolidays(2025);
    const juneDates = holidays.filter((holiday) => holiday.date.startsWith('2025-06'));

    expect(juneDates).toEqual(
      jasmine.arrayContaining([
        jasmine.objectContaining({ date: '2025-06-16' }),
        jasmine.objectContaining({ date: '2025-06-20' }),
      ]),
    );
  });

  it('returns sorted unique holidays for computed years', () => {
    const holidays = getArgentinaHolidays(2028);
    const dates = holidays.map((holiday) => holiday.date);

    expect(dates).toEqual([...dates].sort());
    expect(new Set(dates).size).toBe(dates.length);
  });
});
