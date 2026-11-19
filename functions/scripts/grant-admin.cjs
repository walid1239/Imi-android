#!/usr/bin/env node
// Run locally with Application Default Credentials for the intended Firebase project.
// Never expose this script through an HTTP endpoint or commit service-account keys.
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

async function main() {
  const uid = process.env.IMI_ADMIN_UID;
  const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
  if (!uid || !projectId) {
    throw new Error('Set IMI_ADMIN_UID and GCLOUD_PROJECT (or FIREBASE_PROJECT_ID).');
  }
  if (process.env.CONFIRM_GRANT_IMI_ADMIN !== `GRANT_ADMIN_TO_${uid}`) {
    throw new Error('Set CONFIRM_GRANT_IMI_ADMIN to the exact value GRANT_ADMIN_TO_<uid>.');
  }
  const app = initializeApp({ credential: applicationDefault(), projectId });
  const auth = getAuth(app);
  const user = await auth.getUser(uid);
  await auth.setCustomUserClaims(uid, { ...(user.customClaims || {}), admin: true });
  const verified = await auth.getUser(uid);
  if (verified.customClaims?.admin !== true) throw new Error('Admin claim verification failed.');
  process.stdout.write(`Granted and verified IMI admin claim for UID ${uid} in project ${projectId}. The user must refresh their ID token.\n`);
}

main().catch(error => {
  process.stderr.write(`Admin claim provisioning failed: ${error.message}\n`);
  process.exitCode = 1;
});
