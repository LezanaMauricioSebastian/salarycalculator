import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

const CLIENT_ID_KEY = 'moms-salary-client-id';

@Injectable({ providedIn: 'root' })
export class ClientIdService {
  isSharedWorkspace(): boolean {
    return Boolean(environment.sharedClientId);
  }

  getClientId(): string {
    if (environment.sharedClientId) {
      return environment.sharedClientId;
    }

    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing) {
      return existing;
    }

    const created = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, created);
    return created;
  }
}
