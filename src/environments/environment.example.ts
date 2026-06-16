// Copiá este archivo a environment.ts y environment.prod.ts
// con las credenciales del proyecto Supabase "calculate_salary".
// Settings → API → Project URL y anon public key

import { SHARED_CLIENT_ID } from './shared-workspace';

export const environment = {
  production: false,
  supabaseUrl: 'https://TU_PROJECT_REF.supabase.co',
  supabaseAnonKey: 'TU_ANON_KEY',
  sharedClientId: SHARED_CLIENT_ID,
};
