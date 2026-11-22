#!/usr/bin/env node
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const requireFunctions = createRequire(require.resolve('../functions/package.json'));
const { initializeApp, getApps } = requireFunctions('firebase-admin/app');
const { getAuth } = requireFunctions('firebase-admin/auth');
const { getFirestore } = requireFunctions('firebase-admin/firestore');

const projectId = process.env.GCLOUD_PROJECT || 'demo-imi-curriculum-admin';
if (!projectId.startsWith('demo-')
  || !process.env.FIRESTORE_EMULATOR_HOST
  || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Curriculum admin integration tests require Auth and Firestore Emulators with a demo-* project.');
}
if (!getApps().length) initializeApp({ projectId });
const auth = getAuth();
const db = getFirestore();
const endpoint = 'http://127.0.0.1:5001/' + projectId + '/us-central1/academyCurriculumAdminAction';

async function tokenFor(uid) {
  const customToken = await auth.createCustomToken(uid);
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error('Auth Emulator sign-in failed: ' + JSON.stringify(body));
  return body.idToken;
}

async function call(data, idToken) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(idToken ? { authorization: 'Bearer ' + idToken } : {}),
    },
    body: JSON.stringify({ data }),
  });
  const body = await response.json();
  if (!response.ok || body.error) {
    const error = new Error(body.error?.message || 'Curriculum callable failed.');
    error.code = body.error?.status || 'UNKNOWN';
    throw error;
  }
  return body.result;
}

async function main() {
  const adminUid = 'curriculum-admin-001';
  const memberUid = 'curriculum-member-001';
  await auth.createUser({ uid: adminUid, email: adminUid + '@example.invalid' });
  await auth.createUser({ uid: memberUid, email: memberUid + '@example.invalid' });
  await auth.setCustomUserClaims(adminUid, { admin: true });
  const adminToken = await tokenFor(adminUid);
  const memberToken = await tokenFor(memberUid);

  await assert.rejects(
    call({ action: 'createCurriculumNode', id: 'unauth-level', type: 'level', nameAr: 'غير مصرح', order: 1 }),
    error => error.code === 'UNAUTHENTICATED',
  );
  await assert.rejects(
    call({ action: 'createCurriculumNode', id: 'member-level', type: 'level', nameAr: 'عضو', order: 1 }, memberToken),
    error => error.code === 'PERMISSION_DENIED',
  );

  const root = await call({
    action: 'createCurriculumNode', id: 'level-main', type: 'level',
    parentId: null, nameAr: 'المستوى التجريبي', nameFr: '', language: 'ar', order: 1,
  }, adminToken);
  assert.equal(root.nodeId, 'level-main');
  assert.equal(root.status, 'hidden');
  assert.equal(root.needsReview, true);

  const track = await call({
    action: 'createCurriculumNode', id: 'track-main', type: 'track',
    parentId: 'level-main', nameAr: 'المسار التجريبي', nameFr: 'Parcours test', order: 1,
  }, adminToken);
  assert.equal(track.nodeId, 'track-main');
  assert.equal((await db.doc('curriculumNodes/track-main').get()).get('needsReview'), true);

  const imported = await call({
    action: 'importCurriculumNodes',
    nodes: [
      { id: 'level-imported', type: 'level', parentId: null, nameAr: 'مستوى مستورد', nameFr: '', order: 1 },
      { id: 'track-imported', type: 'track', parentId: 'level-imported', nameAr: 'مسار مستورد', nameFr: '', order: 1 },
    ],
  }, adminToken);
  assert.equal(imported.imported, 2);
  assert.equal((await db.doc('curriculumNodes/track-imported').get()).get('parentId'), 'level-imported');

  await assert.rejects(
    call({
      action: 'importCurriculumNodes',
      nodes: [
        { id: 'cycle-track', type: 'track', parentId: 'cycle-subject', nameAr: 'مسار', nameFr: '', order: 1 },
        { id: 'cycle-subject', type: 'subject', parentId: 'cycle-track', nameAr: 'مادة', nameFr: '', order: 1 },
      ],
    }, adminToken),
    error => error.code === 'INVALID_ARGUMENT',
  );
  await assert.rejects(
    call({
      action: 'importCurriculumNodes',
      nodes: [
        { id: 'duplicate-node', type: 'level', parentId: null, nameAr: 'أ', nameFr: '', order: 1 },
        { id: 'duplicate-node', type: 'level', parentId: null, nameAr: 'ب', nameFr: '', order: 2 },
      ],
    }, adminToken),
    error => error.code === 'INVALID_ARGUMENT',
  );

  const reordered = await call({ action: 'reorderCurriculumNode', nodeId: 'track-main', delta: 1 }, adminToken);
  assert.equal(reordered.order, 2);
  assert.equal((await db.doc('curriculumNodes/track-main').get()).get('order'), 2);
  await assert.rejects(
    call({ action: 'reorderCurriculumNode', nodeId: 'track-main', delta: 2 }, adminToken),
    error => error.code === 'INVALID_ARGUMENT',
  );

  await db.doc('curriculumNodes/track-target').set({
    id: 'track-target', parentId: 'level-main', type: 'track',
    nameAr: 'المسار الهدف', nameFr: '', language: 'ar', order: 2,
    needsReview: false, status: 'published',
  });
  await call({
    action: 'createCurriculumNode', id: 'track-source', type: 'track',
    parentId: 'level-main', nameAr: 'المسار المصدر', nameFr: '', order: 3,
  }, adminToken);
  await call({
    action: 'createCurriculumNode', id: 'subject-to-move', type: 'subject',
    parentId: 'track-source', nameAr: 'مادة ستنقل', nameFr: '', order: 1,
  }, adminToken);
  const merged = await call({
    action: 'mergeCurriculumNode', nodeId: 'track-source', targetId: 'track-target',
  }, adminToken);
  assert.equal(merged.targetId, 'track-target');
  assert.equal(merged.movedChildren, 1);
  const [sourceAfter, childAfter] = await Promise.all([
    db.doc('curriculumNodes/track-source').get(),
    db.doc('curriculumNodes/subject-to-move').get(),
  ]);
  assert.equal(sourceAfter.get('status'), 'hidden');
  assert.equal(sourceAfter.get('mergedInto'), 'track-target');
  assert.equal(childAfter.get('parentId'), 'track-target');

  console.log('PASS: academyCurriculumAdminAction create/import/reorder/merge, admin guards, hierarchy-cycle rejection, duplicate-ID rejection and Firestore transaction effects verified against disposable Auth/Firestore Emulators.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
