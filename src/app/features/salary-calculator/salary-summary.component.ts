import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { SalaryBreakdown } from '../../core/models/work-day.model';

@Component({
  selector: 'app-salary-summary',
  imports: [MatCardModule, CurrencyPipe, DecimalPipe],
  template: `
    <mat-card class="panel-card summary-card">
      <mat-card-header>
        <mat-card-title>Resumen del sueldo</mat-card-title>
      </mat-card-header>

      <mat-card-content class="summary-grid">
        <div class="summary-item">
          <span class="label">Días normales</span>
          <strong>{{ breakdown().regularDays }}</strong>
        </div>
        <div class="summary-item">
          <span class="label">Días feriado</span>
          <strong>{{ breakdown().holidayDays }}</strong>
        </div>
        <div class="summary-item">
          <span class="label">Días fin de semana</span>
          <strong>{{ breakdown().weekendDays }}</strong>
        </div>
        <div class="summary-item">
          <span class="label">Horas normales</span>
          <strong>{{ breakdown().regularHours | number: '1.0-1' }}</strong>
        </div>
        <div class="summary-item">
          <span class="label">Horas feriado</span>
          <strong>{{ breakdown().holidayHours | number: '1.0-1' }}</strong>
        </div>
        <div class="summary-item">
          <span class="label">Horas fin de semana</span>
          <strong>{{ breakdown().weekendHours | number: '1.0-1' }}</strong>
        </div>
        <div class="summary-item">
          <span class="label">Total horas</span>
          <strong>{{ breakdown().totalHours | number: '1.0-1' }}</strong>
        </div>
        <div class="summary-item">
          <span class="label">Sueldo días normales</span>
          <strong>{{ breakdown().regularPay | currency: 'ARS' : 'symbol-narrow' : '1.0-0' : 'es-AR' }}</strong>
        </div>
        <div class="summary-item">
          <span class="label">Sueldo feriados</span>
          <strong>{{ breakdown().holidayPay | currency: 'ARS' : 'symbol-narrow' : '1.0-0' : 'es-AR' }}</strong>
        </div>
        <div class="summary-item">
          <span class="label">Sueldo fin de semana</span>
          <strong>{{ breakdown().weekendPay | currency: 'ARS' : 'symbol-narrow' : '1.0-0' : 'es-AR' }}</strong>
        </div>
        <div class="summary-item total">
          <span class="label">Total a cobrar</span>
          <strong>{{ breakdown().totalPay | currency: 'ARS' : 'symbol-narrow' : '1.0-0' : 'es-AR' }}</strong>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .panel-card {
      margin-bottom: 1rem;
    }

    .summary-card {
      background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
    }

    .summary-grid {
      display: grid;
      gap: 0.75rem;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }

    @media (max-width: 600px) {
      .summary-grid {
        grid-template-columns: 1fr;
      }

      .summary-item strong {
        font-size: 1rem;
      }

      .summary-item.total strong {
        font-size: 1.35rem;
      }
    }

    .summary-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.75rem;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 10px;
      background: white;
    }

    .summary-item.total {
      grid-column: 1 / -1;
      background: #e8f5e9;
      border-color: #66bb6a;
    }

    .label {
      font-size: 0.85rem;
      color: rgba(0, 0, 0, 0.6);
    }

    .summary-item strong {
      font-size: 1.1rem;
    }

    .summary-item.total strong {
      font-size: 1.5rem;
      color: #2e7d32;
    }
  `,
})
export class SalarySummaryComponent {
  readonly breakdown = input.required<SalaryBreakdown>();
}
