import { Component, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { PaymentPeriodType } from '../../core/models/payment-period.model';
import { SettingsService } from '../../core/services/settings.service';

@Component({
  selector: 'app-settings-panel',
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatCardModule, MatSelectModule],
  template: `
    <mat-card class="panel-card">
      <mat-card-header>
        <mat-card-title>Configuración</mat-card-title>
      </mat-card-header>
      <mat-card-content class="settings-grid">
        <mat-form-field appearance="outline">
          <mat-label>Período de cobro</mat-label>
          <mat-select
            [ngModel]="settingsService.settings().paymentPeriodType"
            (ngModelChange)="updatePaymentPeriodType($event)"
          >
            <mat-option value="quincenal">Cada 15 días (quincenal)</mat-option>
            <mat-option value="mensual">Mensual</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Tarifa por hora ($)</mat-label>
          <input
            matInput
            type="number"
            min="1"
            step="100"
            inputmode="numeric"
            [ngModel]="settingsService.settings().hourlyRate"
            (ngModelChange)="updateSetting('hourlyRate', $event)"
          />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Tarifa por hora en feriado ($)</mat-label>
          <input
            matInput
            type="number"
            min="1"
            step="100"
            inputmode="numeric"
            [ngModel]="settingsService.settings().holidayHourlyRate"
            (ngModelChange)="updateSetting('holidayHourlyRate', $event)"
          />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Tarifa por hora fin de semana ($)</mat-label>
          <input
            matInput
            type="number"
            min="1"
            step="100"
            inputmode="numeric"
            [ngModel]="settingsService.settings().weekendHourlyRate"
            (ngModelChange)="updateSetting('weekendHourlyRate', $event)"
          />
          <mat-hint>Sábado y domingo (si no es feriado)</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Horas por día</mat-label>
          <input
            matInput
            type="number"
            min="1"
            max="24"
            step="0.5"
            inputmode="decimal"
            [ngModel]="settingsService.settings().defaultHoursPerDay"
            (ngModelChange)="updateSetting('defaultHoursPerDay', $event)"
          />
          <mat-hint>Se guarda automáticamente</mat-hint>
        </mat-form-field>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .panel-card {
      margin-bottom: 1rem;
    }

    .settings-grid {
      display: grid;
      gap: 0.5rem 1rem;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      padding-top: 0.5rem;
    }

    @media (max-width: 600px) {
      .settings-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class SettingsPanelComponent {
  readonly settingsService = inject(SettingsService);
  readonly paymentPeriodTypeChange = output<PaymentPeriodType>();

  updateSetting(
    key: 'hourlyRate' | 'defaultHoursPerDay' | 'holidayHourlyRate' | 'weekendHourlyRate',
    value: number,
  ): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }

    this.settingsService.update({ [key]: parsed });
  }

  updatePaymentPeriodType(value: PaymentPeriodType): void {
    this.settingsService.update({ paymentPeriodType: value });
    this.paymentPeriodTypeChange.emit(value);
  }
}
