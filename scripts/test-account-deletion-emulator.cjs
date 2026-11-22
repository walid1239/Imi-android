#!/usr/bin/env node
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const requireFunctions = createRequire(require.resolve('../functions/package.json'));
const { initializeApp, getApps } = requireFunctions('firebase-admin/app');
const { getFirestore } = requireFunctions('firebase-admin/firestore');
const { getStorage } = requireFunctions('firebase-admin/storage');
const { cleanupAccountData } = requireFunctions('../functions/lib/shared/accountDeletion.js');

const projectId = process.env.GCLOUD_PROJECT || 'demo-imi-account-delete';
if (!projectId.startsWith('demo-') || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  throw new Error('Account deletion tests require Firestore and Storage emulators with a demo-* project.');
}
if (!process.env.STORAGE_EMULATOR_HOST) process.env.STORAGE_EMULATOR_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
if (!getApps().length) initializeApp({ projectId, storageBucket: projectId + '.firebasestorage.app' });
const db = getFirestore();
const bucket = getStorage().bucket(projectId + '.firebasestorage.app');
const uid = 'account-delete-user';
const other = 'account-delete-other';

async function putFile(path) {
  await bucket.file(path).save(Buffer.from('emulator-only'));
}
async function fileExists(path) {
  try { await bucket.file(path).getMetadata(); return true; }
  catch (error) { if (error.code === 404) return false; throw error; }
}

async function main() {
  await db.doc('users/' + uid).set({ displayName: 'Delete me' });
  await db.doc('users/' + uid + '/friends/' + other).set({ uid: other, status: 'accepted' });
  await db.doc('users/' + other + '/friends/' + uid).set({ uid, status: 'accepted' });
  await db.doc('users/' + uid + '/blockedUsers/' + other).set({ uid: other });
  await db.doc('users/' + other + '/blockedUsers/' + uid).set({ uid });

  await db.doc('conversations/group-keep').set({
    type: 'group', participants: [uid, other], ownerUid: uid, admins: [uid], updatedAt: new Date()
  });
  await db.doc('conversations/group-keep/messages/group-message').set({ senderUid: uid, text: 'group history stays' });
  await db.doc('conversations/direct-delete').set({
    type: 'direct', participants: [uid, other], updatedAt: new Date()
  });
  await db.doc('conversations/direct-delete/messages/direct-message').set({ senderUid: uid, text: 'direct history removed' });

  await db.doc('calls/call-as-caller').set({ callerUid: uid, calleeUid: other, status: 'ended' });
  await db.doc('calls/call-as-caller/callerCandidates/candidate-1').set({ candidate: 'one' });
  await db.doc('calls/call-as-callee').set({ callerUid: other, calleeUid: uid, status: 'ended' });
  await db.doc('calls/call-as-callee/calleeCandidates/candidate-1').set({ candidate: 'two' });

  await db.doc('friendRequests/outgoing').set({ fromUid: uid, toUid: other, status: 'pending' });
  await db.doc('friendRequests/incoming').set({ fromUid: other, toUid: uid, status: 'pending' });
  await db.doc('contentReports/report-1').set({ reporterUid: uid, targetUid: other });
  await db.doc('teacherContent/content-1').set({ ownerUid: uid, mediaPath: 'teacher-content/' + uid + '/content-1/file.pdf' });
  await db.doc('reels/reel-1').set({ ownerUid: uid, storagePath: 'reels/' + uid + '/reel-1/video.mp4' });
  await db.doc('statuses/status-1').set({ ownerUid: uid, mediaPath: 'statuses/' + uid + '/status-1/image.png' });
  await db.doc('teacherLiveSessions/session-1').set({ teacherUid: uid, recordingPath: 'teachers/' + uid + '/live/session-1.mp4' });
  await db.doc('teacherClaimsOutbox/claim-1').set({ targetUid: uid, status: 'pending' });
  await db.doc('reportRateLimits/' + uid).set({ count: 10 });
  const rateLimitKey = createHash('sha256').update('createStatus:' + uid).digest('hex');
  await db.doc('apiRateLimits/' + rateLimitKey).set({ operation: 'createStatus', uidHash: rateLimitKey, count: 1 });
  await db.doc('teacherApplications/' + uid).set({ uid, proofUrl: 'https://drive.google.com/file/d/account-delete-proof/view' });
  await db.doc('teacherProfiles/' + uid).set({ uid, photoPath: 'teachers/' + uid + '/avatar/profile.png' });
  await db.doc('publicProfiles/' + uid).set({ uid, photoPath: 'users/' + uid + '/avatar/profile.png' });

  const paths = [
    'users/' + uid + '/avatar/profile.png',
    'teachers/' + uid + '/avatar/profile.png',
    'teacher-content/' + uid + '/content-1/file.pdf',
    'reels/' + uid + '/reel-1/video.mp4',
    'statuses/' + uid + '/status-1/image.png',
    'teachers/' + uid + '/live/session-1.mp4',
    'conversations/group-keep/' + uid + '/message-1/file.bin',
    'conversations/group-keep/' + other + '/message-2/file.bin',
    'conversations/direct-delete/' + uid + '/message-1/file.bin',
    'conversations/direct-delete/' + other + '/message-2/file.bin',
  ];
  for (const path of paths) await putFile(path);

  await cleanupAccountData(db, bucket, uid);

  assert.equal((await db.doc('users/' + uid).get()).exists, false);
  assert.equal((await db.doc('publicProfiles/' + uid).get()).exists, false);
  assert.equal((await db.doc('teacherApplications/' + uid).get()).exists, false);
  assert.equal((await db.doc('teacherProfiles/' + uid).get()).exists, false);
  assert.equal((await db.doc('reportRateLimits/' + uid).get()).exists, false);
  assert.equal((await db.doc('apiRateLimits/' + rateLimitKey).get()).exists, false);
  assert.equal((await db.doc('friendRequests/outgoing').get()).exists, false);
  assert.equal((await db.doc('friendRequests/incoming').get()).exists, false);
  assert.equal((await db.doc('contentReports/report-1').get()).exists, false);
  assert.equal((await db.doc('teacherContent/content-1').get()).exists, false);
  assert.equal((await db.doc('reels/reel-1').get()).exists, false);
  assert.equal((await db.doc('statuses/status-1').get()).exists, false);
  assert.equal((await db.doc('teacherLiveSessions/session-1').get()).exists, false);
  assert.equal((await db.doc('teacherClaimsOutbox/claim-1').get()).exists, false);
  assert.equal((await db.doc('users/' + other + '/friends/' + uid).get()).exists, false);
  assert.equal((await db.doc('users/' + other + '/blockedUsers/' + uid).get()).exists, false);
  assert.equal((await db.doc('calls/call-as-caller').get()).exists, false);
  assert.equal((await db.doc('calls/call-as-caller/callerCandidates/candidate-1').get()).exists, false);
  assert.equal((await db.doc('calls/call-as-callee').get()).exists, false);
  assert.equal((await db.doc('calls/call-as-callee/calleeCandidates/candidate-1').get()).exists, false);
  assert.equal((await db.doc('conversations/direct-delete').get()).exists, false);
  assert.equal((await db.doc('conversations/group-keep').get()).exists, true);
  assert.deepEqual((await db.doc('conversations/group-keep').get()).get('participants'), [other]);
  assert.equal((await db.doc('conversations/group-keep/messages/group-message').get()).exists, true);

  for (const path of paths.filter(path => !path.includes('/' + other + '/message-2/'))) {
    assert.equal(await fileExists(path), false, 'expected Storage file to be removed: ' + path);
  }
  assert.equal(await fileExists('conversations/group-keep/' + other + '/message-2/file.bin'), true);

  const protectedUid = 'account-delete-storage-failure';
  await db.doc('users/' + protectedUid).set({ displayName: 'Must remain on storage error' });
  const failingBucket = {
    getFiles: async ({ prefix }) => prefix.startsWith('users/' + protectedUid + '/')
      ? [[{ name: 'users/' + protectedUid + '/avatar.png', delete: async () => { throw new Error('storage-delete-failed'); } }]]
      : [[]],
    file: () => ({ name: 'unused', delete: async () => {} }),
  };
  await assert.rejects(cleanupAccountData(db, failingBucket, protectedUid), /storage-delete-failed/);
  assert.equal((await db.doc('users/' + protectedUid).get()).exists, true);

  // A Firestore batch failure after Storage deletion must be safely retryable.
  const retryUid = 'account-delete-retry-midway';
  await db.doc('users/' + retryUid).set({ displayName: 'Retry cleanup' });
  await db.doc('conversations/group-retry').set({
    type: 'group', participants: [retryUid, other], ownerUid: retryUid,
    admins: [retryUid], updatedAt: new Date(),
  });
  await putFile('users/' + retryUid + '/avatar.png');
  let failFirstBatch = true;
  const flakyDb = new Proxy(db, {
    get(target, property) {
      if (property === 'batch') return () => {
        const batch = target.batch();
        return {
          delete: ref => batch.delete(ref),
          update: (ref, data) => batch.update(ref, data),
          commit: async () => {
            if (failFirstBatch) {
              failFirstBatch = false;
              throw new Error('simulated-mid-cleanup-firestore-failure');
            }
            return batch.commit();
          },
        };
      };
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  await assert.rejects(
    cleanupAccountData(flakyDb, bucket, retryUid),
    /simulated-mid-cleanup-firestore-failure/,
  );
  assert.equal(await fileExists('users/' + retryUid + '/avatar.png'), false);
  assert.equal((await db.doc('users/' + retryUid).get()).exists, true);
  await cleanupAccountData(db, bucket, retryUid);
  await cleanupAccountData(db, bucket, retryUid);
  assert.equal((await db.doc('users/' + retryUid).get()).exists, false);
  assert.deepEqual((await db.doc('conversations/group-retry').get()).get('participants'), [other]);
  process.stdout.write('Account deletion emulator cleanup, Storage failure, and mid-cleanup retry tests passed.\n');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
