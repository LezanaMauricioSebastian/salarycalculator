import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  getQuincenaRange,
  PaymentPeriod,
  PaymentPeriodType,
  Quincena,
  shiftPaymentPeriod,
} from '../../core/models/payment-period.model';

@Component({
  selector: 'app-month-selector',
  imports: [FormsModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatSelectModule],
  template: `
    <div class="period-selector">
      <button mat-icon-button type="button" aria-label="Período anterior" (click)="shiftPeriod(-1)">
        <mat-icon>chevron_left</mat-icon>
      </button>

      <mat-form-field appearance="outline" class="month-field">
        <mat-label>Mes</mat-label>
        <mat-select [ngModel]="period().month" (ngModelChange)="onMonthChange($event)">
          @for (option of monthOptions; track option.value) {
            <mat-option [value]="option.value">{{ option.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="year-field">
        <mat-label>Año</mat-label>
        <mat-select [ngModel]="period().year" (ngModelChange)="onYearChange($event)">
          @for (option of yearOptions; track option) {
            <mat-option [value]="option">{{ option }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      @if (paymentPeriodType() === 'quincenal') {
        <mat-form-field appearance="outline" class="quincena-field">
          <mat-label>Quincena</mat-label>
          <mat-select [ngModel]="period().quincena" (ngModelChange)="onQuincenaChange($event)">
            <mat-option value="primera">1ra (1–15)</mat-option>
            <mat-option value="segunda">2da (16–fin)</mat-option>
          </mat-select>
        </mat-form-field>
      }

      <button mat-icon-button type="button" aria-label="Período siguiente" (click)="shiftPeriod(1)">
        <mat-icon>chevron_right</mat-icon>
      </button>
    </div>

    <p class="period-label">{{ periodLabel() }}</p>
  `,
  styles: `
    .period-selector {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .month-field,
    .year-field,
    .quincena-field {
      width: 140px;
    }

    .quincena-field {
      width: 160px;
    }

    .period-label {
      margin: 0.25rem 0 0;
      font-size: 1.1rem;
      font-weight: 500;
      text-transform: capitalize;
    }

    @media (max-width: 600px) {
      .period-selector {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: start;
      }

      .month-field,
      .year-field,
      .quincena-field {
        width: 100%;
        grid-column: 1 / -1;
      }

      .period-label {
        font-size: 1rem;
      }
    }
  `,
})
export class MonthSelectorComponent {
  readonly period = input.required<PaymentPeriod>();
  readonly paymentPeriodType = input.required<PaymentPeriodType>();
  readonly periodChange = output<PaymentPeriod>();

  readonly monthOptions = [
    { value: 0, label: 'Enero' },
    { value: 1, label: 'Febrero' },
    { value: 2, label: 'Marzo' },
    { value: 3, label: 'Abril' },
    { value: 4, label: 'Mayo' },
    { value: 5, label: 'Junio' },
    { value: 6, label: 'Julio' },
    { value: 7, label: 'Agosto' },
    { value: 8, label: 'Septiembre' },
    { value: 9, label: 'Octubre' },
    { value: 10, label: 'Noviembre' },
    { value: 11, label: 'Diciembre' },
  ];

  readonly yearOptions = Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - 1 + index);

  periodLabel(): string {
    const current = this.period();

    if (this.paymentPeriodType() === 'mensual') {
      return format(new Date(current.year, current.month, 1), 'MMMM yyyy', { locale: es });
    }

    const { start, end } = getQuincenaRange(current.year, current.month, current.quincena);
    const monthName = format(new Date(current.year, current.month, 1), 'MMMM yyyy', { locale: es });
    const rangeLabel = `${format(start, 'd')}–${format(end, 'd')} de ${monthName}`;

    return current.quincena === 'primera' ? `1ra quincena: ${rangeLabel}` : `2da quincena: ${rangeLabel}`;
  }

  shiftPeriod(delta: number): void {
    if (this.paymentPeriodType() === 'mensual') {
      const date = new Date(this.period().year, this.period().month + delta, 1);
      this.periodChange.emit({
        year: date.getFullYear(),
        month: date.getMonth(),
        quincena: this.period().quincena,
      });
      return;
    }

    this.periodChange.emit(shiftPaymentPeriod(this.period(), delta));
  }

  onMonthChange(month: number): void {
    this.periodChange.emit({ ...this.period(), month });
  }

  onYearChange(year: number): void {
    this.periodChange.emit({ ...this.period(), year });
  }

  onQuincenaChange(quincena: Quincena): void {
    this.periodChange.emit({ ...this.period(), quincena });
  }
}
