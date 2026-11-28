const hosted = process.env.VERCEL === '1' || process.env.CHECK_PRODUCTION_ENV === 'true';
if (!hosted) process.exit(0);
const errors = [];
const required = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'FIREBASE_PROJECT_ID',
  'GCP_PROJECT_NUMBER',
  'GCP_WORKLOAD_IDENTITY_POOL_ID',
  'GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID',
  'FIREBASE_SERVICE_ACCOUNT_EMAIL'
];
for (const key of required) if (!process.env[key]) errors.push('متغير مفقود: ' + key);
const forbidden = [
  'NEXT_PUBLIC_FIREBASE_EMULATORS',
  'IMI_USE_FIREBASE_EMULATORS',
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIRESTORE_EMULATOR_HOST',
  'IMI_ADMIN_HEALTH',
  'IMI_ACCOUNT_DELETION_ENABLED',
  'FIREBASE_SERVICE_ACCOUNT_JSON'
];
for (const key of forbidden) if (process.env[key]) errors.push('متغير ممنوع في الاستضافة: ' + key);
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID !== 'imi-indroid') errors.push('FIREBASE_PROJECT_ID يجب أن يكون imi-indroid');
if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'imi-indroid') errors.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID يجب أن يكون imi-indroid');
if (process.env.GCP_PROJECT_NUMBER && !/^\d{6,20}$/.test(process.env.GCP_PROJECT_NUMBER)) errors.push('GCP_PROJECT_NUMBER غير صالح');
if (process.env.GCP_WORKLOAD_IDENTITY_POOL_ID && !/^[a-z][a-z0-9-]{2,31}$/.test(process.env.GCP_WORKLOAD_IDENTITY_POOL_ID)) errors.push('GCP_WORKLOAD_IDENTITY_POOL_ID غير صالح');
if (process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID && !/^[a-z][a-z0-9-]{2,31}$/.test(process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID)) errors.push('GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID غير صالح');
if (process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL && !/^firebase-adminsdk-[a-z0-9-]+@imi-indroid\.iam\.gserviceaccount\.com$/.test(process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL)) errors.push('FIREBASE_SERVICE_ACCOUNT_EMAIL يجب أن يخص مشروع imi-indroid');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
