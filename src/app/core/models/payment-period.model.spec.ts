import {
  getCurrentPaymentPeriod,
  getQuincenaRange,
  shiftPaymentPeriod,
} from './payment-period.model';

describe('Payment period', () => {
  it('returns first quincena range from day 1 to 15', () => {
    const { start, end } = getQuincenaRange(2025, 5, 'primera');

    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(5);
    expect(end.getDate()).toBe(15);
  });

  it('returns second quincena range from day 16 to month end', () => {
    const { start, end } = getQuincenaRange(2025, 5, 'segunda');

    expect(start.getDate()).toBe(16);
    expect(end.getDate()).toBe(30);
  });

  it('shifts from first to second quincena within same month', () => {
    const next = shiftPaymentPeriod({ year: 2025, month: 5, quincena: 'primera' }, 1);

    expect(next).toEqual({ year: 2025, month: 5, quincena: 'segunda' });
  });

  it('shifts from second quincena to first quincena of next month', () => {
    const next = shiftPaymentPeriod({ year: 2025, month: 5, quincena: 'segunda' }, 1);

    expect(next).toEqual({ year: 2025, month: 6, quincena: 'primera' });
  });

  it('detects current quincena from today', () => {
    const period = getCurrentPaymentPeriod();
    const today = new Date();

    expect(period.year).toBe(today.getFullYear());
    expect(period.month).toBe(today.getMonth());
    expect(period.quincena).toBe(today.getDate() <= 15 ? 'primera' : 'segunda');
  });
});
