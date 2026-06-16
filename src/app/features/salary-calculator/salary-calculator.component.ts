import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { getDay, parseISO } from 'date-fns';
import {
  getCurrentPaymentPeriod,
  PaymentPeriod,
  PaymentPeriodType,
} from '../../core/models/payment-period.model';
import { SalaryService } from '../../core/services/salary.service';
import { SettingsService } from '../../core/services/settings.service';
import { WorkDayService } from '../../core/services/work-day.service';
import { MonthSelectorComponent } from './month-selector.component';
import { SalarySummaryComponent } from './salary-summary.component';
import { SettingsPanelComponent } from './settings-panel.component';
import { WorkDayCalendarComponent } from './work-day-calendar.component';

@Component({
  selector: 'app-salary-calculator',
  imports: [
    MatToolbarModule,
    SettingsPanelComponent,
    MonthSelectorComponent,
    WorkDayCalendarComponent,
    SalarySummaryComponent,
  ],
  template: `
    <mat-toolbar color="primary">
      <span>Calculadora de sueldo</span>
    </mat-toolbar>

    <main class="page-content">
      <p class="intro">
        Marcá los días que trabajaste en el período. Los feriados nacionales de Argentina se detectan solos.
      </p>

      <app-settings-panel (paymentPeriodTypeChange)="onPaymentPeriodTypeChange()" />

      <app-month-selector
        [period]="period()"
        [paymentPeriodType]="settingsService.settings().paymentPeriodType"
        (periodChange)="setPeriod($event)"
      />

      <app-work-day-calendar
        [calendarTitle]="calendarTitle()"
        [defaultHoursPerDay]="settingsService.settings().defaultHoursPerDay"
        [holidayHourlyRate]="settingsService.settings().holidayHourlyRate"
        [workDays]="workDays()"
        (toggleDay)="toggleDay($event)"
        (hoursChange)="updateHours($event.date, $event.hours)"
        (selectWeekdays)="selectWeekdays()"
        (clearAll)="clearAll()"
      />

      <app-salary-summary [breakdown]="breakdown()" />
    </main>
  `,
  styles: `
    .page-content {
      max-width: 960px;
      margin: 0 auto;
      padding: 1rem;
    }

    .intro {
      margin: 0 0 1rem;
      color: rgba(0, 0, 0, 0.7);
      line-height: 1.5;
    }

    @media (max-width: 600px) {
      .page-content {
        padding: 0.75rem;
      }

      .intro {
        font-size: 0.95rem;
      }
    }
  `,
})
export class SalaryCalculatorComponent {
  readonly settingsService = inject(SettingsService);
  private readonly workDayService = inject(WorkDayService);
  private readonly salaryService = inject(SalaryService);

  readonly period = signal<PaymentPeriod>(getCurrentPaymentPeriod());
  readonly workDays = signal(
    this.buildWorkDays(getCurrentPaymentPeriod(), this.settingsService.settings()),
  );

  private readonly customHoursByDate = signal<Record<string, number>>({});

  readonly calendarTitle = computed(() =>
    this.settingsService.settings().paymentPeriodType === 'quincenal'
      ? 'Calendario de la quincena'
      : 'Calendario del mes',
  );

  readonly breakdown = computed(() =>
    this.salaryService.calculate(this.workDays(), this.settingsService.settings()),
  );

  constructor() {
    effect(() => {
      const defaultHours = this.settingsService.settings().defaultHoursPerDay;
      const overrides = this.customHoursByDate();

      this.workDays.update((days) =>
        days.map((day) => {
          if (!day.date) {
            return day;
          }

          return {
            ...day,
            hours: overrides[day.date] ?? defaultHours,
          };
        }),
      );
    });
  }

  setPeriod(period: PaymentPeriod): void {
    this.period.set(period);
    this.customHoursByDate.set({});
    this.rebuildCalendar();
  }

  onPaymentPeriodTypeChange(): void {
    this.customHoursByDate.set({});
    this.rebuildCalendar();
  }

  toggleDay(date: string): void {
    this.workDays.update((days) =>
      days.map((day) => (day.date === date ? { ...day, selected: !day.selected } : day)),
    );
  }

  updateHours(date: string, hours: number): void {
    const parsed = Number(hours);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }

    this.customHoursByDate.update((overrides) => ({ ...overrides, [date]: parsed }));
    this.workDays.update((days) =>
      days.map((day) => (day.date === date ? { ...day, hours: parsed } : day)),
    );
  }

  selectWeekdays(): void {
    this.workDays.update((days) =>
      days.map((day) =>
        day.date
          ? {
              ...day,
              selected: this.isWeekday(parseISO(day.date)),
            }
          : day,
      ),
    );
  }

  clearAll(): void {
    this.workDays.update((days) => days.map((day) => (day.date ? { ...day, selected: false } : day)));
  }

  private rebuildCalendar(): void {
    this.workDays.set(this.buildWorkDays(this.period(), this.settingsService.settings()));
  }

  private buildWorkDays(period: PaymentPeriod, settings: { defaultHoursPerDay: number; paymentPeriodType: PaymentPeriodType }) {
    if (settings.paymentPeriodType === 'quincenal') {
      return this.workDayService.buildQuincena(
        period.year,
        period.month,
        period.quincena,
        settings.defaultHoursPerDay,
      );
    }

    return this.workDayService.buildMonth(period.year, period.month, settings.defaultHoursPerDay);
  }

  private isWeekday(date: Date): boolean {
    const day = getDay(date);
    return day >= 1 && day <= 5;
  }
}
