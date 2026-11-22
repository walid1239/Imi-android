import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const checker = fileURLToPath(new URL('./check-env.mjs', import.meta.url));
const validPublic = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'imi-indroid.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'imi-indroid',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'imi-indroid.firebasestorage.app',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:test',
  FIREBASE_PROJECT_ID: 'imi-indroid',
  FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    type: 'service_account',
    project_id: 'imi-indroid',
    client_email: 'ci-test@imi-indroid.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nCI_ONLY_NOT_A_SECRET\n-----END PRIVATE KEY-----',
  }),
};

function runChecker(overrides = {}) {
  const env = { ...process.env };
  for (const key of [
    'VERCEL', 'CHECK_PRODUCTION_ENV', 'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID', 'FIREBASE_PROJECT_ID', 'FIREBASE_SERVICE_ACCOUNT_JSON',
    'NEXT_PUBLIC_FIREBASE_EMULATORS', 'IMI_USE_FIREBASE_EMULATORS',
    'FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST',
    'FIREBASE_STORAGE_EMULATOR_HOST', 'FIREBASE_DATABASE_EMULATOR_HOST',
  ]) delete env[key];
  Object.assign(env, overrides);
  return spawnSync(process.execPath, [checker], {
    env,
    encoding: 'utf8',
  });
}

test('local build without production flag succeeds silently', () => {
  const result = runChecker();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

test('explicit production check rejects missing configuration clearly', () => {
  const result = runChecker({ CHECK_PRODUCTION_ENV: 'true' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing required production environment variables/);
  assert.doesNotMatch(result.stderr, /PRIVATE KEY|CI_ONLY_NOT_A_SECRET/);
});

test('Vercel production build enforces complete valid configuration', () => {
  const result = runChecker({ ...validPublic, VERCEL: '1' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

test('rejects a Firebase project other than imi-indroid', () => {
  const result = runChecker({
    ...validPublic,
    CHECK_PRODUCTION_ENV: 'true',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'wrong-project',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Production Firebase project must be imi-indroid/);
});

test('rejects enabled Firebase Emulator configuration in production', () => {
  const result = runChecker({
    ...validPublic,
    CHECK_PRODUCTION_ENV: 'true',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Emulator configuration is forbidden in production/);
});

test('rejects invalid service-account JSON without printing its contents', () => {
  const marker = 'PRIVATE_KEY_MUST_NOT_LEAK';
  const result = runChecker({
    ...validPublic,
    CHECK_PRODUCTION_ENV: 'true',
    FIREBASE_SERVICE_ACCOUNT_JSON: marker,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /FIREBASE_SERVICE_ACCOUNT_JSON must be valid service-account JSON/);
  assert.doesNotMatch(result.stderr, new RegExp(marker));
});

test('rejects a service account belonging to another Firebase project', () => {
  const result = runChecker({
    ...validPublic,
    CHECK_PRODUCTION_ENV: 'true',
    FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
      type: 'service_account',
      project_id: 'another-project',
      client_email: 'ci-test@example.test',
      private_key: '-----BEGIN PRIVATE KEY-----\nCI_ONLY\n-----END PRIVATE KEY-----',
    }),
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /FIREBASE_SERVICE_ACCOUNT_JSON must be valid service-account JSON/);
});
