import { CurrencyPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { WorkDay } from '../../core/models/work-day.model';

@Component({
  selector: 'app-work-day-calendar',
  imports: [
    CurrencyPipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <mat-card class="panel-card">
      <mat-card-header>
        <mat-card-title>{{ calendarTitle() }}</mat-card-title>
        <mat-card-subtitle>Tocá un día para seleccionarlo o deseleccionarlo</mat-card-subtitle>
      </mat-card-header>

      <mat-card-content>
        <div class="quick-actions">
          <button mat-stroked-button type="button" (click)="selectWeekdays.emit()">Seleccionar lun–vie</button>
          <button mat-stroked-button type="button" (click)="clearAll.emit()">Deseleccionar todo</button>
        </div>

        <div class="weekday-header">
          @for (label of weekdayLabels; track label) {
            <span>{{ label }}</span>
          }
        </div>

        <div class="calendar-grid">
          @for (day of workDays(); track $index) {
            @if (!day.date) {
              <div class="day-cell empty"></div>
            } @else {
              <button
                type="button"
                class="day-cell"
                [class.selected]="day.selected"
                [class.holiday]="day.isHoliday"
                (click)="toggleDay.emit(day.date)"
              >
                <span class="day-number">{{ dayNumber(day.date) }}</span>
                @if (day.isHoliday) {
                  <span class="holiday-badge">F</span>
                }
                @if (day.selected) {
                  <span class="hours-label">{{ day.hours }}h</span>
                }
              </button>
            }
          }
        </div>

        @if (holidayDays().length > 0) {
          <mat-expansion-panel class="expand-panel">
            <mat-expansion-panel-header>
              <mat-panel-title class="panel-header-content">
                <span class="panel-header-title">Feriados</span>
                <span class="panel-header-summary">{{ holidayPanelSummary() }}</span>
              </mat-panel-title>
            </mat-expansion-panel-header>

            <p class="panel-hint">
              Tarifa en feriado:
              <strong>{{ holidayHourlyRate() | currency: 'ARS' : 'symbol-narrow' : '1.0-0' : 'es-AR' }}/h</strong>
              (guardada)
            </p>

            <div class="holiday-rows">
              @for (day of holidayDays(); track day.date) {
                <div class="holiday-row">
                  <span class="holiday-day-number">{{ dayNumber(day.date) }}</span>
                  <span class="holiday-detail">{{ day.holidayName }}</span>
                </div>
              }
            </div>
          </mat-expansion-panel>
        }

        @if (selectedDays().length > 0) {
          <mat-expansion-panel class="expand-panel">
            <mat-expansion-panel-header>
              <mat-panel-title class="panel-header-content">
                <span class="panel-header-title">Horas por día</span>
                <span class="panel-header-summary">{{ hoursPanelSummary() }}</span>
              </mat-panel-title>
            </mat-expansion-panel-header>

            <p class="panel-hint">
              Por defecto se usan <strong>{{ defaultHoursPerDay() }}h</strong> guardadas en configuración.
              Expandí solo si algún día fue distinto.
            </p>

            @for (day of selectedDays(); track day.date) {
              <div class="hours-row">
                <span class="day-label">{{ formatDayLabel(day.date) }}</span>
                <mat-form-field appearance="outline" class="hours-field">
                  <mat-label>Horas</mat-label>
                  <input
                    matInput
                    type="number"
                    min="0.5"
                    max="24"
                    step="0.5"
                    inputmode="decimal"
                    [ngModel]="day.hours"
                    (ngModelChange)="hoursChange.emit({ date: day.date, hours: $event })"
                  />
                </mat-form-field>
              </div>
            }
          </mat-expansion-panel>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .panel-card {
      margin-bottom: 1rem;
    }

    .quick-actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-bottom: 1rem;
    }

    .quick-actions button {
      min-height: 44px;
    }

    .weekday-header,
    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 0.35rem;
    }

    .weekday-header {
      margin-bottom: 0.35rem;
      text-align: center;
      font-size: 0.8rem;
      font-weight: 500;
      color: rgba(0, 0, 0, 0.6);
    }

    .day-cell {
      min-height: 72px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 10px;
      background: #fafafa;
      padding: 0.35rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.15rem;
      cursor: pointer;
      transition: background-color 0.15s ease, border-color 0.15s ease;
    }

    .day-cell.empty {
      visibility: hidden;
      pointer-events: none;
    }

    .day-cell.selected {
      background: #e3f2fd;
      border-color: #1976d2;
    }

    .day-cell.holiday {
      background: #fff3e0;
    }

    .day-cell.selected.holiday {
      background: #ffe0b2;
      border-color: #ef6c00;
    }

    .day-number {
      font-size: 1rem;
      font-weight: 600;
    }

    .holiday-badge {
      font-size: 0.7rem;
      font-weight: 700;
      color: #e65100;
      line-height: 1;
    }

    .hours-label {
      font-size: 0.75rem;
      color: rgba(0, 0, 0, 0.7);
    }

    .expand-panel {
      margin-top: 1rem;
    }

    .panel-header-content {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.2rem;
      margin-right: 0.5rem;
      min-width: 0;
      flex: 1;
    }

    .panel-header-title {
      font-weight: 500;
      line-height: 1.25;
      white-space: normal;
    }

    .panel-header-summary {
      font-size: 0.85rem;
      font-weight: 400;
      line-height: 1.25;
      color: rgba(0, 0, 0, 0.6);
      white-space: normal;
    }

    :host ::ng-deep .expand-panel .mat-expansion-panel-header {
      height: auto;
      min-height: 3.5rem;
      padding-top: 0.75rem;
      padding-bottom: 0.75rem;
    }

    :host ::ng-deep .expand-panel .mat-expansion-panel-header-title {
      margin-right: 0;
      flex-grow: 1;
    }

    .panel-hint {
      margin: 0 0 1rem;
      color: rgba(0, 0, 0, 0.65);
      font-size: 0.9rem;
    }

    .holiday-rows {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .holiday-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .holiday-day-number {
      min-width: 2.5rem;
      height: 2.5rem;
      border-radius: 999px;
      background: #fff3e0;
      color: #e65100;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .holiday-detail {
      font-size: 0.95rem;
      line-height: 1.3;
    }

    .hours-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.5rem;
    }

    .day-label {
      flex: 1;
      min-width: 0;
      text-transform: capitalize;
    }

    .hours-field {
      width: 120px;
      flex-shrink: 0;
    }

    @media (max-width: 600px) {
      .weekday-header {
        font-size: 0.7rem;
      }

      .day-cell {
        min-height: 52px;
        padding: 0.15rem;
        border-radius: 8px;
      }

      .day-number {
        font-size: 0.85rem;
      }

      .hours-label,
      .holiday-badge {
        font-size: 0.6rem;
      }

      .quick-actions {
        flex-direction: column;
      }

      .quick-actions button {
        width: 100%;
      }

      .hours-row {
        flex-direction: column;
        align-items: stretch;
      }

      .hours-field {
        width: 100%;
      }
    }
  `,
})
export class WorkDayCalendarComponent {
  readonly workDays = input.required<WorkDay[]>();
  readonly calendarTitle = input('Calendario del período');
  readonly defaultHoursPerDay = input(8);
  readonly holidayHourlyRate = input(4800);
  readonly toggleDay = output<string>();
  readonly hoursChange = output<{ date: string; hours: number }>();
  readonly selectWeekdays = output<void>();
  readonly clearAll = output<void>();

  readonly weekdayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  hoursPanelSummary(): string {
    const selected = this.selectedDays();
    const defaultHours = this.defaultHoursPerDay();
    const customizedCount = selected.filter((day) => day.hours !== defaultHours).length;

    if (customizedCount === 0) {
      return `${defaultHours}h guardadas`;
    }

    return `${defaultHours}h · ${customizedCount} día(s) distinto(s)`;
  }

  holidayPanelSummary(): string {
    const days = this.holidayDays().map((day) => this.dayNumber(day.date));
    return `Días ${days.join(', ')} · ${this.formatRate(this.holidayHourlyRate())}/h`;
  }

  holidayDays(): WorkDay[] {
    return this.workDays().filter((day) => day.date && day.isHoliday);
  }

  selectedDays(): WorkDay[] {
    return this.workDays().filter((day) => day.date && day.selected);
  }

  dayNumber(date: string): string {
    return format(parseISO(date), 'd');
  }

  formatDayLabel(date: string): string {
    return format(parseISO(date), "EEEE d 'de' MMMM", { locale: es });
  }

  private formatRate(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
