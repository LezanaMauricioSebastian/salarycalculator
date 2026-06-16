export type EmployeeSwitchAction = 'select' | 'create' | 'archive';

export interface EmployeeSwitchEvent {
  fromId: string;
  toId: string;
  action: EmployeeSwitchAction;
}
