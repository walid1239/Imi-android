import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
const script = fileURLToPath(new URL('./check-env.mjs', import.meta.url));
function run(extra) {
  const env = { ...process.env };
  for (const key of ['VERCEL','CHECK_PRODUCTION_ENV','NEXT_PUBLIC_FIREBASE_API_KEY','NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN','NEXT_PUBLIC_FIREBASE_PROJECT_ID','NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET','NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID','NEXT_PUBLIC_FIREBASE_APP_ID','FIREBASE_PROJECT_ID','FIREBASE_SERVICE_ACCOUNT_JSON','NEXT_PUBLIC_FIREBASE_EMULATORS','IMI_USE_FIREBASE_EMULATORS','FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST','IMI_ADMIN_HEALTH','IMI_ACCOUNT_DELETION_ENABLED']) delete env[key];
  Object.assign(env, extra);
  return spawnSync(process.execPath, [script], { env, encoding: 'utf8' });
}
test('local build skips hosted checks silently', () => {
  const result = run({});
  assert.equal(result.status, 0); assert.equal(result.stdout, ''); assert.equal(result.stderr, '');
});
test('hosted build reports missing settings without exposing credentials', () => {
  const result = run({ CHECK_PRODUCTION_ENV: 'true' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /متغير مفقود: NEXT_PUBLIC_FIREBASE_API_KEY/);
  assert.match(result.stderr, /متغير مفقود: FIREBASE_SERVICE_ACCOUNT_JSON/);
  assert.doesNotMatch(result.stderr, /private_key|client_email/);
});
test('hosted build rejects emulator and unsafe flags', () => {
  const result = run({ CHECK_PRODUCTION_ENV: 'true', NEXT_PUBLIC_FIREBASE_EMULATORS: 'false', IMI_ADMIN_HEALTH: 'true', IMI_ACCOUNT_DELETION_ENABLED: 'true' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /NEXT_PUBLIC_FIREBASE_EMULATORS/);
  assert.match(result.stderr, /IMI_ADMIN_HEALTH/);
  assert.match(result.stderr, /IMI_ACCOUNT_DELETION_ENABLED/);
});
