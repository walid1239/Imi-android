#!/usr/bin/env node
// Run locally with Application Default Credentials for the intended Firebase project.
// Never expose this script through an HTTP endpoint or commit service-account keys.
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

async function main() {
  const uidInput = process.env.IMI_ADMIN_UID?.trim();
  const emailInput = process.env.IMI_ADMIN_EMAIL?.trim();
  const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
  if ((!uidInput && !emailInput) || (uidInput && emailInput) || !projectId) {
    throw new Error('Set IMI_ADMIN_UID and GCLOUD_PROJECT (or IMI_ADMIN_EMAIL and GCLOUD_PROJECT); provide exactly one account identifier.');
  }
  if (projectId !== 'imi-indroid') {
    throw new Error(`Refusing to grant admin outside the approved IMI project (received: ${projectId}).`);
  }
  if (uidInput && process.env.CONFIRM_GRANT_IMI_ADMIN !== `GRANT_ADMIN_TO_${uidInput}`) {
    throw new Error(`Set CONFIRM_GRANT_IMI_ADMIN to the exact value GRANT_ADMIN_TO_${uidInput}.`);
  }

  const app = initializeApp({ credential: applicationDefault(), projectId });
  const auth = getAuth(app);
  const user = uidInput ? await auth.getUser(uidInput) : await auth.getUserByEmail(emailInput);
  const confirmation = `GRANT_ADMIN_TO_${user.uid}`;
  if (process.env.CONFIRM_GRANT_IMI_ADMIN !== confirmation) {
    throw new Error(`Set CONFIRM_GRANT_IMI_ADMIN to the exact value ${confirmation} after verifying the selected account.`);
  }
  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: true });
  const verified = await auth.getUser(user.uid);
  if (verified.customClaims?.admin !== true) throw new Error('Admin claim verification failed.');
  process.stdout.write(`Granted and verified IMI admin claim for UID ${user.uid} in project ${projectId}. The user must refresh their ID token.\n`);
}

main().catch(error => {
  process.stderr.write(`Admin claim provisioning failed: ${error.message}\n`);
  process.exitCode = 1;
});
