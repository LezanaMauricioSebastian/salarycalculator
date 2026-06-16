import { AppSettings, DEFAULT_SETTINGS } from './app-settings.model';

export type EmployeeSettings = AppSettings;

export const DEFAULT_EMPLOYEE_SETTINGS: EmployeeSettings = { ...DEFAULT_SETTINGS };
