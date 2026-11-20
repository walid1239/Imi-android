#!/usr/bin/env node
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const requireFunctions = createRequire(require.resolve('../functions/package.json'));
const { initializeApp, getApps } = requireFunctions('firebase-admin/app');
const { getAuth } = requireFunctions('firebase-admin/auth');
const { getFirestore, Timestamp } = requireFunctions('firebase-admin/firestore');
const { getStorage } = requireFunctions('firebase-admin/storage');

const projectId = process.env.GCLOUD_PROJECT || 'demo-imi-teacher';
if (!projectId.startsWith('demo-')
  || !process.env.FIRESTORE_EMULATOR_HOST
  || !process.env.FIREBASE_AUTH_EMULATOR_HOST
  || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  throw new Error('Teacher integration tests require Auth, Firestore and Storage Emulators with a demo-* project.');
}
if (!getApps().length) initializeApp({ projectId, storageBucket: projectId + '.firebasestorage.app' });
const auth = getAuth();
const db = getFirestore();
const bucket = getStorage().bucket();
const baseUrl = 'http://127.0.0.1:5001/' + projectId + '/us-central1/';

async function tokenFor(uid) {
  const customToken = await auth.createCustomToken(uid);
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error('Auth Emulator sign-in failed: ' + JSON.stringify(body));
  return body.idToken;
}

async function call(name, data, idToken) {
  const response = await fetch(baseUrl + name, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(idToken ? { authorization: 'Bearer ' + idToken } : {}),
    },
    body: JSON.stringify({ data }),
  });
  const body = await response.json();
  if (!response.ok || body.error) {
    const error = new Error(body.error?.message || ('Callable failed: ' + name));
    error.code = body.error?.status || 'UNKNOWN';
    throw error;
  }
  return body.result;
}

async function waitFor(predicate, label, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Timed out waiting for ' + label);
}

async function main() {
  const applicantUid = 'teacher-applicant-001';
  const adminUid = 'teacher-admin-001';
  await auth.createUser({ uid: applicantUid, email: applicantUid + '@example.invalid' });
  await auth.createUser({ uid: adminUid, email: adminUid + '@example.invalid' });
  await auth.setCustomUserClaims(adminUid, { admin: true });
  await db.doc('curriculumNodes/level-primary').set({
    id: 'level-primary', parentId: null, type: 'level', nameAr: 'مستوى اختبار',
    nameFr: 'Niveau test', language: 'ar', order: 1, needsReview: false, status: 'published',
  });
  await db.doc('curriculumNodes/track-primary').set({
    id: 'track-primary', parentId: 'level-primary', type: 'track', nameAr: 'مسار اختبار',
    nameFr: 'Parcours test', language: 'ar', order: 1, needsReview: false, status: 'published',
  });
  await db.doc('curriculumNodes/subject-math').set({
    id: 'subject-math', parentId: 'track-primary', type: 'subject', nameAr: 'رياضيات اختبار',
    nameFr: 'Mathématiques test', language: 'ar', order: 1, needsReview: false, status: 'published',
  });
  const evidencePath = 'teacher-verification/' + applicantUid + '/identity.pdf';
  await bucket.file(evidencePath).save(Buffer.from('%PDF-1.4 emulator-only evidence'), {
    metadata: { contentType: 'application/pdf' },
  });

  await db.doc('curriculumNodes/unreviewed-unit').set({
    id: 'unreviewed-unit', parentId: 'subject-math', type: 'unit', nameAr: 'وحدة تنتظر المراجعة',
    nameFr: 'Unité en attente', language: 'ar', order: 1, needsReview: true, status: 'hidden',
  });
  await assert.rejects(
    call('reviewCurriculumNode', { nodeId: 'unreviewed-unit', approved: true }, applicantToken),
    error => error.code === 'PERMISSION_DENIED',
  );
  const curriculumReview = await call('reviewCurriculumNode', { nodeId: 'unreviewed-unit', approved: true }, await tokenFor(adminUid));
  assert.equal(curriculumReview.status, 'published');
  const reviewedNode = await db.doc('curriculumNodes/unreviewed-unit').get();
  assert.equal(reviewedNode.get('needsReview'), false);
  assert.equal(reviewedNode.get('reviewedBy'), adminUid);
  assert.ok(reviewedNode.get('reviewedAt') instanceof Timestamp);
  assert.equal((await db.collection('moderationAudit').doc(curriculumReview.operationId).get()).get('action'), 'curriculum_node_approved');

  await assert.rejects(call('submitTeacherApplication', {}, null), error => error.code === 'UNAUTHENTICATED');
  const applicantToken = await tokenFor(applicantUid);
  const submitted = await call('submitTeacherApplication', {
    fullName: 'أستاذ اختبار',
    levelIds: ['level-primary'],
    subjectIds: ['subject-math'],
    evidencePath,
  }, applicantToken);
  assert.equal(submitted.status, 'pending');

  await db.doc('teacherApplications/' + applicantUid).get().then(snapshot => {
    assert.equal(snapshot.get('status'), 'pending');
    assert.ok(snapshot.get('submittedAt') instanceof Timestamp);
  });

  await assert.rejects(
    call('reviewTeacherApplication', { uid: applicantUid, approved: true }, applicantToken),
    error => error.code === 'PERMISSION_DENIED',
  );

  const adminToken = await tokenFor(adminUid);
  const review = await call('reviewTeacherApplication', { uid: applicantUid, approved: true }, adminToken);
  assert.equal(review.status, 'approved');
  assert.equal(review.claimsSync, 'queued');
  assert.ok(review.operationId);

  const auditRef = db.collection('moderationAudit').doc(review.operationId);
  const outboxRef = db.collection('teacherClaimsOutbox').doc(review.operationId);
  const [application, audit, outbox] = await Promise.all([
    db.doc('teacherApplications/' + applicantUid).get(), auditRef.get(), outboxRef.get(),
  ]);
  assert.equal(application.get('status'), 'approved');
  assert.equal(application.get('reviewOperationId'), review.operationId);
  assert.ok(application.get('reviewedAt') instanceof Timestamp);
  assert.equal(audit.get('action'), 'teacher_application_approved');
  assert.equal(outbox.get('status'), 'pending');

  await waitFor(async () => (await outboxRef.get()).get('status') === 'applied', 'teacher Auth claims outbox');
  const userAfterReview = await auth.getUser(applicantUid);
  assert.equal(userAfterReview.customClaims.teacher, true);
  assert.equal(userAfterReview.customClaims.teacherVerified, true);

  const refreshedApplicantToken = await tokenFor(applicantUid);
  const avatarPath = 'teachers/' + applicantUid + '/avatar/profile.png';
  await bucket.file(avatarPath).save(Buffer.from('fake-png'), {
    metadata: { contentType: 'image/png' },
  });
  const profile = await call('saveTeacherProfile', {
    photoPath: avatarPath,
    bio: 'نبذة اختبارية طويلة بما يكفي للتحقق من حفظ ملف الأستاذ.',
    levelIds: ['level-primary'],
    subjectIds: ['subject-math'],
    contentAgreement: true,
    childSafetyAgreement: true,
  }, refreshedApplicantToken);
  assert.equal(profile.profileComplete, true);
  const profileSnapshot = await db.doc('teacherProfiles/' + applicantUid).get();
  const acceptances = profileSnapshot.get('agreementAcceptances');
  assert.equal(acceptances.contentRights.acceptedBy, applicantUid);
  assert.equal(acceptances.childSafety.acceptedBy, applicantUid);
  assert.equal(acceptances.contentRights.version, 'content-rights-2026-11-19-v1');
  assert.equal(acceptances.childSafety.version, 'child-safety-2026-11-19-v1');
  assert.ok(acceptances.contentRights.acceptedAt instanceof Timestamp);
  assert.ok(acceptances.childSafety.acceptedAt instanceof Timestamp);

  const contentId = 'teacher-content-001';
  const createdContent = await call('createTeacherContent', {
    contentId,
    title: 'درس أصلي للاختبار',
    kind: 'text',
    content: 'هذا محتوى تعليمي اختباري أصلي يتجاوز الحد الأدنى المطلوب للتحقق من مسار إنشاء المحتوى ومراجعته.',
    levelId: 'level-primary',
    trackId: 'track-primary',
    subjectId: 'subject-math',
    sourceType: 'original',
    sourceName: 'محتوى أصلي',
    license: 'أصلي',
    permissionNote: 'أنا المؤلف الأصلي وأملك حقوق هذا المحتوى.',
  }, refreshedApplicantToken);
  assert.equal(createdContent.status, 'draft');
  const draftSnapshot = await db.doc('teacherContent/' + contentId).get();
  const contentReviewOperationId = 'teacher-content-' + contentId + '-' + draftSnapshot.updateTime.toMillis();
  await assert.rejects(
    call('reviewTeacherContent', { contentId, approved: true }, refreshedApplicantToken),
    error => error.code === 'PERMISSION_DENIED',
  );
  const contentReview = await call('reviewTeacherContent', { contentId, approved: true }, adminToken);
  assert.equal(contentReview.status, 'published');
  assert.equal(contentReview.idempotent, false);
  const publishedContent = await db.doc('teacherContent/' + contentId).get();
  assert.equal(publishedContent.get('status'), 'published');
  assert.equal(publishedContent.get('reviewStatus'), 'approved');
  const contentAudit = await db.collection('moderationAudit').doc(contentReviewOperationId).get();
  assert.equal(contentAudit.get('action'), 'teacher_content_published');
  const repeatedContentReview = await call('reviewTeacherContent', { contentId, approved: true }, adminToken);
  assert.equal(repeatedContentReview.idempotent, true);

  const startsAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const scheduled = await call('scheduleTeacherLiveSession', {
    title: 'جلسة اختبار تجريبية',
    subjectId: 'subject-math',
    startsAt,
  }, refreshedApplicantToken);
  assert.equal(scheduled.status, 'mock_scheduled');
  assert.equal(scheduled.liveEnabled, false);
  const session = await db.doc('teacherLiveSessions/' + scheduled.sessionId).get();
  assert.equal(session.get('provider'), 'mock');
  assert.equal(session.get('liveEnabled'), false);
  assert.equal(session.get('joinUrl'), null);
  assert.equal(session.get('recordingPath'), null);

  process.stdout.write('PASS: unauthenticated application rejected; non-admin teacher and content reviews rejected; teacher and content decisions/audits atomic; outbox claims synced; agreements use server timestamps; mock session cannot create a live room.\\n');
}

main().catch(error => {
  process.stderr.write(String(error.stack || error) + '\\n');
  process.exitCode = 1;
});
