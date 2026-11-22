#!/usr/bin/env node

const productionCheck = process.env.VERCEL === '1' || process.env.CHECK_PRODUCTION_ENV === 'true';
if (!productionCheck) process.exit(0);

const requiredPublic = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];
const missing = requiredPublic.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Missing required production environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'imi-indroid'
  || process.env.FIREBASE_PROJECT_ID !== 'imi-indroid') {
  console.error('Production Firebase project must be imi-indroid (NEXT_PUBLIC_FIREBASE_PROJECT_ID and FIREBASE_PROJECT_ID).');
  process.exit(1);
}

const forbidden = [
  'NEXT_PUBLIC_FIREBASE_EMULATORS',
  'IMI_USE_FIREBASE_EMULATORS',
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_STORAGE_EMULATOR_HOST',
  'FIREBASE_DATABASE_EMULATOR_HOST',
];
const enabledForbidden = forbidden.filter((name) => {
  const value = process.env[name]?.trim();
  return value && value !== 'false' && value !== '0';
});
if (enabledForbidden.length) {
  console.error(`Emulator configuration is forbidden in production: ${enabledForbidden.join(', ')}`);
  process.exit(1);
}

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!raw) {
  console.error('FIREBASE_SERVICE_ACCOUNT_JSON is required for the production server runtime.');
  process.exit(1);
}
try {
  const serviceAccount = JSON.parse(raw);
  if (!serviceAccount || typeof serviceAccount !== 'object' || Array.isArray(serviceAccount)
    || serviceAccount.project_id !== 'imi-indroid'
    || typeof serviceAccount.client_email !== 'string' || !serviceAccount.client_email.trim()
    || typeof serviceAccount.private_key !== 'string' || !serviceAccount.private_key.includes('PRIVATE KEY')) {
    throw new Error('invalid service account fields');
  }
} catch {
  console.error('FIREBASE_SERVICE_ACCOUNT_JSON must be valid service-account JSON for imi-indroid.');
  process.exit(1);
}
