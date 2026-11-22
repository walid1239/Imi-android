const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const script = path.join(__dirname, '..', 'scripts', 'grant-admin.cjs');

function runProvisioning(env) {
  return spawnSync(process.execPath, [script], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: 5000,
  });
}

test('admin provisioning refuses to run without an explicit UID and project', () => {
  const result = runProvisioning({
    IMI_ADMIN_UID: '',
    GCLOUD_PROJECT: '',
    FIREBASE_PROJECT_ID: '',
    CONFIRM_GRANT_IMI_ADMIN: '',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Set IMI_ADMIN_UID and GCLOUD_PROJECT/);
});

test('admin provisioning refuses any project other than imi-indroid', () => {
  const result = runProvisioning({
    IMI_ADMIN_UID: 'test-user-uid',
    GCLOUD_PROJECT: 'another-project',
    FIREBASE_PROJECT_ID: '',
    CONFIRM_GRANT_IMI_ADMIN: 'GRANT_ADMIN_TO_test-user-uid',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing to grant admin outside the approved IMI project/);
});

test('admin provisioning requires the exact UID-bound confirmation phrase', () => {
  const result = runProvisioning({
    IMI_ADMIN_UID: 'test-user-uid',
    GCLOUD_PROJECT: 'imi-indroid',
    FIREBASE_PROJECT_ID: '',
    CONFIRM_GRANT_IMI_ADMIN: 'GRANT_ADMIN',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Set CONFIRM_GRANT_IMI_ADMIN to the exact value/);
});
