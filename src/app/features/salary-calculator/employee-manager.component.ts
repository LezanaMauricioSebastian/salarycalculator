import { Component, effect, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { EmployeeService } from '../../core/services/employee.service';
import { EmployeeSwitchEvent } from '../../core/models/employee-switch.model';

@Component({
  selector: 'app-employee-name-dialog',
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content class="dialog-body">
      <label class="field-label" for="employee-name">Nombre del empleado</label>
      <mat-form-field appearance="outline" class="full-width" subscriptSizing="dynamic">
        <input
          id="employee-name"
          matInput
          placeholder="Ej: María"
          [(ngModel)]="name"
          autofocus
          (keyup.enter)="submit()"
        />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button color="primary" [disabled]="!name.trim()" (click)="submit()">
        Guardar
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-body {
      padding-top: 0.5rem;
      overflow: visible;
      min-width: 300px;
    }

    .field-label {
      display: block;
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: rgba(0, 0, 0, 0.7);
    }

    .full-width {
      width: 100%;
    }
  `,
})
export class EmployeeNameDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<EmployeeNameDialogComponent, { initialName: string }>);
  readonly data = inject<{ title: string; initialName: string }>(MAT_DIALOG_DATA);
  name = this.data.initialName;

  submit(): void {
    const trimmed = this.name.trim();
    if (!trimmed) {
      return;
    }

    this.dialogRef.close({ initialName: trimmed });
  }
}

@Component({
  selector: 'app-employee-manager',
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
  ],
  template: `
    <mat-card class="panel-card">
      <mat-card-header>
        <mat-card-title>Personal</mat-card-title>
      </mat-card-header>
      <mat-card-content class="employee-controls">
        <mat-form-field appearance="outline" class="employee-select">
          <mat-label>Empleado</mat-label>
          <mat-select
            [ngModel]="selectedEmployeeId()"
            (ngModelChange)="onEmployeeChange($event)"
          >
            @for (employee of employeeService.activeEmployees(); track employee.id) {
              <mat-option [value]="employee.id">{{ employee.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <div class="action-buttons">
          <button mat-stroked-button type="button" (click)="openCreateDialog()">
            <mat-icon>person_add</mat-icon>
            Agregar
          </button>
          <button
            mat-stroked-button
            type="button"
            [disabled]="!employeeService.activeEmployee()"
            (click)="openRenameDialog()"
          >
            <mat-icon>edit</mat-icon>
            Renombrar
          </button>
          <button
            mat-stroked-button
            type="button"
            color="warn"
            [disabled]="employeeService.activeEmployees().length <= 1"
            (click)="archiveActiveEmployee()"
          >
            <mat-icon>person_off</mat-icon>
            Archivar
          </button>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .panel-card {
      margin-bottom: 1rem;
    }

    .employee-controls {
      display: grid;
      gap: 0.75rem;
      grid-template-columns: minmax(220px, 1fr) auto;
      align-items: start;
      padding-top: 0.5rem;
    }

    .employee-select {
      width: 100%;
    }

    .action-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    @media (max-width: 720px) {
      .employee-controls {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class EmployeeManagerComponent {
  readonly employeeService = inject(EmployeeService);
  readonly employeeSwitch = output<EmployeeSwitchEvent>();
  readonly selectedEmployeeId = signal<string | null>(null);

  private readonly dialog = inject(MatDialog);

  constructor() {
    effect(() => {
      this.selectedEmployeeId.set(this.employeeService.activeEmployee()?.id ?? null);
    });
  }

  onEmployeeChange(employeeId: string): void {
    const fromId = this.employeeService.activeEmployee()?.id;
    if (!fromId || fromId === employeeId) {
      return;
    }

    this.selectedEmployeeId.set(employeeId);
    this.employeeSwitch.emit({ fromId, toId: employeeId, action: 'select' });
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(EmployeeNameDialogComponent, {
      data: { title: 'Agregar empleado', initialName: '' },
    });

    dialogRef.afterClosed().subscribe(async (result?: { initialName: string }) => {
      const name = result?.initialName?.trim();
      if (!name) {
        return;
      }

      const fromId = this.employeeService.activeEmployee()?.id;
      const created = await this.employeeService.createEmployee(name);
      if (!fromId) {
        await this.employeeService.setActiveEmployee(created.id);
        return;
      }

      this.employeeSwitch.emit({ fromId, toId: created.id, action: 'create' });
    });
  }

  openRenameDialog(): void {
    const active = this.employeeService.activeEmployee();
    if (!active) {
      return;
    }

    const dialogRef = this.dialog.open(EmployeeNameDialogComponent, {
      data: { title: 'Renombrar empleado', initialName: active.name },
    });

    dialogRef.afterClosed().subscribe(async (result?: { initialName: string }) => {
      const name = result?.initialName?.trim();
      if (!name || name === active.name) {
        return;
      }

      await this.employeeService.renameEmployee(active.id, name);
    });
  }

  archiveActiveEmployee(): void {
    const active = this.employeeService.activeEmployee();
    if (!active || this.employeeService.activeEmployees().length <= 1) {
      return;
    }

    const next = this.employeeService.activeEmployees().find((employee) => employee.id !== active.id);
    if (!next) {
      return;
    }

    this.employeeSwitch.emit({ fromId: active.id, toId: next.id, action: 'archive' });
  }
}
