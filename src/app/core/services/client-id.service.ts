import { Injectable } from '@angular/core';

const CLIENT_ID_KEY = 'moms-salary-client-id';

@Injectable({ providedIn: 'root' })
export class ClientIdService {
  getClientId(): string {
    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing) {
      return existing;
    }

    const created = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, created);
    return created;
  }
}
