import { TestBed } from '@angular/core/testing';
import { DEFAULT_EMPLOYEE_NAME } from '../models/employee.model';
import { ClientIdService } from './client-id.service';
import { EmployeeService } from './employee.service';

describe('EmployeeService', () => {
  let service: EmployeeService;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        EmployeeService,
        {
          provide: ClientIdService,
          useValue: {
            getClientId: () => 'test-client-id',
            isSharedWorkspace: () => false,
          },
        },
      ],
    });

    service = TestBed.inject(EmployeeService);
  });

  it('creates a default employee on initialize when none exist', async () => {
    await service.initialize();

    expect(service.ready()).toBeTrue();
    expect(service.employees().length).toBe(1);
    expect(service.employees()[0].name).toBe(DEFAULT_EMPLOYEE_NAME);
    expect(service.activeEmployee()?.id).toBe(service.employees()[0].id);
  });

  it('creates and activates a new employee', async () => {
    await service.initialize();

    const created = await service.createEmployee('María');
    await service.setActiveEmployee(created.id);

    expect(service.employees().length).toBe(2);
    expect(service.activeEmployee()?.name).toBe('María');
  });

  it('archives an employee and selects another active one', async () => {
    await service.initialize();
    const second = await service.createEmployee('Juan');
    await service.setActiveEmployee(second.id);

    await service.archiveEmployee(second.id);

    expect(service.activeEmployees().length).toBe(1);
    expect(service.activeEmployee()?.name).toBe(DEFAULT_EMPLOYEE_NAME);
  });
});
