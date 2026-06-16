import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { getDay, parseISO } from 'date-fns';
import {
  getCurrentPaymentPeriod,
  PaymentPeriod,
  PaymentPeriodType,
} from '../../core/models/payment-period.model';
import { WorkDay } from '../../core/models/work-day.model';
import { EmployeeSwitchEvent } from '../../core/models/employee-switch.model';
import { EmployeeService } from '../../core/services/employee.service';
import { SalaryService } from '../../core/services/salary.service';
import { SalaryStorageService } from '../../core/services/salary-storage.service';
import { SettingsService } from '../../core/services/settings.service';
import { WorkDayService } from '../../core/services/work-day.service';
import { EmployeeManagerComponent } from './employee-manager.component';
import { MonthSelectorComponent } from './month-selector.component';
import { SalarySummaryComponent } from './salary-summary.component';
import { SettingsPanelComponent } from './settings-panel.component';
import { WorkDayCalendarComponent } from './work-day-calendar.component';

@Component({
  selector: 'app-salary-calculator',
  imports: [
    MatToolbarModule,
    MatProgressSpinnerModule,
    EmployeeManagerComponent,
    SettingsPanelComponent,
    MonthSelectorComponent,
    WorkDayCalendarComponent,
    SalarySummaryComponent,
  ],
  template: `
    <mat-toolbar color="primary">
      <span>Calculadora de sueldo</span>
      @if (settingsService.syncEnabled()) {
        <span class="sync-badge sync-on">Sincronizado</span>
      } @else {
        <span class="sync-badge sync-off">Solo este dispositivo</span>
      }
    </mat-toolbar>

    @if (!settingsService.ready() || !employeeService.ready()) {
      <div class="loading-state">
        <mat-spinner diameter="40" />
        <p>Cargando datos...</p>
      </div>
    } @else {
      <main class="page-content">
        <p class="intro">
          Seleccioná un empleado y marcá sus días trabajados en el período. Los feriados nacionales de
          Argentina se detectan solos.
        </p>

        <app-employee-manager (employeeSwitch)="onEmployeeSwitch($event)" />

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
          [weekendHourlyRate]="settingsService.settings().weekendHourlyRate"
          [workDays]="workDays()"
          (toggleDay)="toggleDay($event)"
          (hoursChange)="updateHours($event.date, $event.hours)"
          (selectWeekdays)="selectWeekdays()"
          (clearAll)="clearAll()"
        />

        <app-salary-summary [breakdown]="breakdown()" />
      </main>
    }
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

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      min-height: 240px;
      color: rgba(0, 0, 0, 0.6);
    }

    .sync-badge {
      margin-left: auto;
      font-size: 0.75rem;
      opacity: 0.9;
    }

    .sync-badge.sync-off {
      color: #ffecb3;
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
export class SalaryCalculatorComponent implements OnInit {
  readonly settingsService = inject(SettingsService);
  readonly employeeService = inject(EmployeeService);
  private readonly storageService = inject(SalaryStorageService);
  private readonly workDayService = inject(WorkDayService);
  private readonly salaryService = inject(SalaryService);

  readonly period = signal<PaymentPeriod>(getCurrentPaymentPeriod());
  readonly workDays = signal<WorkDay[]>([]);
  private readonly customHoursByDate = signal<Record<string, number>>({});

  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

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

  async ngOnInit(): Promise<void> {
    const initialPeriod = await this.settingsService.getInitialPeriod();
    this.period.set(initialPeriod);
    await this.loadPeriod(initialPeriod);
  }

  async onEmployeeSwitch(event: EmployeeSwitchEvent): Promise<void> {
    await this.persistForEmployee(event.fromId);

    if (event.action === 'archive') {
      await this.employeeService.archiveEmployee(event.fromId);
    }

    await this.employeeService.setActiveEmployee(event.toId);
    await this.settingsService.reloadForActiveEmployee();

    const initialPeriod = await this.settingsService.getInitialPeriod();
    this.period.set(initialPeriod);
    this.customHoursByDate.set({});
    this.workDays.set([]);
    await this.loadPeriod(initialPeriod);
  }

  setPeriod(period: PaymentPeriod): void {
    void this.persistNow();
    this.period.set(period);
    this.customHoursByDate.set({});
    void this.loadPeriod(period);
  }

  onPaymentPeriodTypeChange(): void {
    void this.persistNow();
    this.customHoursByDate.set({});
    void this.loadPeriod(this.period());
  }

  toggleDay(date: string): void {
    this.workDays.update((days) =>
      days.map((day) => (day.date === date ? { ...day, selected: !day.selected } : day)),
    );
    this.scheduleSave();
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
    this.scheduleSave();
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
    this.scheduleSave();
  }

  clearAll(): void {
    this.workDays.update((days) => days.map((day) => (day.date ? { ...day, selected: false } : day)));
    this.scheduleSave();
  }

  private async loadPeriod(period: PaymentPeriod): Promise<void> {
    const employee = this.employeeService.activeEmployee();
    if (!employee) {
      this.workDays.set([]);
      return;
    }

    const settings = this.settingsService.settings();
    const builtDays = this.buildWorkDays(period, settings);
    const stored = await this.storageService.loadPeriodState(
      employee.id,
      period,
      settings.paymentPeriodType,
      settings.defaultHoursPerDay,
    );

    if (!stored) {
      this.workDays.set(builtDays);
      return;
    }

    const storedByDate = new Map(stored.workDays.map((day) => [day.date, day]));
    this.customHoursByDate.set(stored.customHoursByDate);

    this.workDays.set(
      builtDays.map((day) => {
        if (!day.date) {
          return day;
        }

        const saved = storedByDate.get(day.date);
        if (!saved) {
          return day;
        }

        return {
          ...day,
          selected: saved.selected,
          hours: saved.hours,
        };
      }),
    );
  }

  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      void this.persistNow();
    }, 600);
  }

  private persistNow(): Promise<void> {
    const employee = this.employeeService.activeEmployee();
    if (!employee) {
      return Promise.resolve();
    }

    return this.persistForEmployee(employee.id);
  }

  private async persistForEmployee(employeeId: string): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    const settings = this.settingsService.settings();
    await this.storageService.savePeriodState(
      employeeId,
      this.period(),
      settings.paymentPeriodType,
      this.workDays(),
      settings.defaultHoursPerDay,
    );
  }

  private buildWorkDays(
    period: PaymentPeriod,
    settings: { defaultHoursPerDay: number; paymentPeriodType: PaymentPeriodType },
  ): WorkDay[] {
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
