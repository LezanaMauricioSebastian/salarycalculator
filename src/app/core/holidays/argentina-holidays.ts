import { format, getDay, subDays } from 'date-fns';
import { ArgentinaHoliday, HOLIDAY_OVERRIDES } from './holiday-data';

const FIXED_INAMOVIBLE_HOLIDAYS: ReadonlyArray<{ month: number; day: number; name: string }> = [
  { month: 1, day: 1, name: 'Año Nuevo' },
  { month: 3, day: 24, name: 'Día Nacional de la Memoria por la Verdad y la Justicia' },
  { month: 4, day: 2, name: 'Día del Veterano y de los Caídos en la Guerra de Malvinas' },
  { month: 5, day: 1, name: 'Día del Trabajador' },
  { month: 5, day: 25, name: 'Día de la Revolución de Mayo' },
  { month: 6, day: 20, name: 'Paso a la Inmortalidad del General Don Manuel Belgrano' },
  { month: 7, day: 9, name: 'Día de la Independencia' },
  { month: 12, day: 8, name: 'Día de la Inmaculada Concepción de María' },
  { month: 12, day: 25, name: 'Navidad' },
];

const TRASLADABLE_HOLIDAYS: ReadonlyArray<{ month: number; day: number; name: string }> = [
  { month: 6, day: 17, name: 'Paso a la Inmortalidad del General Don Martín Miguel de Güemes' },
  { month: 8, day: 17, name: 'Paso a la Inmortalidad del General Don José de San Martín' },
  { month: 10, day: 12, name: 'Día del Respeto a la Diversidad Cultural' },
  { month: 11, day: 20, name: 'Día de la Soberanía Nacional' },
];

function calculateEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}

function applyTrasladoRule(date: Date): Date {
  const weekday = getDay(date);

  if (weekday === 2 || weekday === 3) {
    const daysToSubtract = weekday === 2 ? 1 : 2;
    return subDays(date, daysToSubtract);
  }

  if (weekday === 4 || weekday === 5) {
    const daysToAdd = weekday === 4 ? 4 : 3;
    return subDays(date, -daysToAdd);
  }

  if (weekday === 6) {
    return subDays(date, 1);
  }

  if (weekday === 0) {
    return subDays(date, -1);
  }

  return date;
}

function toHoliday(date: Date, name: string): ArgentinaHoliday {
  return {
    date: format(date, 'yyyy-MM-dd'),
    name,
  };
}

function computeHolidaysForYear(year: number): ArgentinaHoliday[] {
  const holidays: ArgentinaHoliday[] = [];

  for (const fixed of FIXED_INAMOVIBLE_HOLIDAYS) {
    holidays.push(toHoliday(new Date(year, fixed.month - 1, fixed.day), fixed.name));
  }

  for (const movable of TRASLADABLE_HOLIDAYS) {
    const baseDate = new Date(year, movable.month - 1, movable.day);
    holidays.push(toHoliday(applyTrasladoRule(baseDate), movable.name));
  }

  const easterSunday = calculateEasterSunday(year);
  holidays.push(toHoliday(subDays(easterSunday, 2), 'Viernes Santo'));
  holidays.push(toHoliday(subDays(easterSunday, 48), 'Lunes de Carnaval'));
  holidays.push(toHoliday(subDays(easterSunday, 47), 'Martes de Carnaval'));

  const uniqueByDate = new Map<string, ArgentinaHoliday>();
  for (const holiday of holidays) {
    uniqueByDate.set(holiday.date, holiday);
  }

  return [...uniqueByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function getArgentinaHolidays(year: number): ArgentinaHoliday[] {
  const override = HOLIDAY_OVERRIDES[year];
  if (override) {
    return [...override].sort((a, b) => a.date.localeCompare(b.date));
  }

  return computeHolidaysForYear(year);
}

export function getArgentinaHolidayMap(year: number): Map<string, string> {
  return new Map(getArgentinaHolidays(year).map((holiday) => [holiday.date, holiday.name]));
}
