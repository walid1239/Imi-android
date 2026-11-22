const hosted = process.env.VERCEL === '1' || process.env.CHECK_PRODUCTION_ENV === 'true';
if (!hosted) process.exit(0);
const errors = [];
const required = ['NEXT_PUBLIC_FIREBASE_API_KEY','NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN','NEXT_PUBLIC_FIREBASE_PROJECT_ID','NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET','NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID','NEXT_PUBLIC_FIREBASE_APP_ID','FIREBASE_PROJECT_ID','FIREBASE_SERVICE_ACCOUNT_JSON'];
for (const key of required) if (!process.env[key]) errors.push('متغير مفقود: ' + key);
const forbidden = ['NEXT_PUBLIC_FIREBASE_EMULATORS','IMI_USE_FIREBASE_EMULATORS','FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST','IMI_ADMIN_HEALTH','IMI_ACCOUNT_DELETION_ENABLED'];
for (const key of forbidden) if (process.env[key]) errors.push('متغير ممنوع في الاستضافة: ' + key);
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID !== 'imi-indroid') errors.push('FIREBASE_PROJECT_ID يجب أن يكون imi-indroid');
if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'imi-indroid') errors.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID يجب أن يكون imi-indroid');
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (account.project_id !== 'imi-indroid' || !account.client_email || !account.private_key) errors.push('FIREBASE_SERVICE_ACCOUNT_JSON غير صالح أو لمشروع آخر');
  } catch { errors.push('FIREBASE_SERVICE_ACCOUNT_JSON ليس JSON صالحاً (الصقه في سطر واحد)'); }
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
