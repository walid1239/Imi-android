import { expect, test } from '@playwright/test';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const authEmulator = 'http://127.0.0.1:9099';
const apiBase = 'http://127.0.0.1:3000';
const password = 'IMI-Emulator-Password-2026!';
const adminSdkApp = getApps().find(app => app.name === 'imi-web-e2e-admin')
  ?? initializeApp({ projectId: 'demo-imi-playwright' }, 'imi-web-e2e-admin');
const adminAuth = getAuth(adminSdkApp);
const adminDb = getFirestore(adminSdkApp);

function fixtureSuffix(project: string, retry: number): string {
  const base = project.includes('mobile') ? 'mobile' : 'desktop';
  return retry > 0 ? `${base}-retry${retry}` : base;
}

async function idToken(email: string): Promise<string> {
  const response = await fetch(
    `${authEmulator}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const payload = await response.json() as { idToken?: string; error?: { message?: string } };
  if (!response.ok || !payload.idToken) {
    throw new Error(`Auth Emulator sign-in failed: ${payload.error?.message ?? response.status}`);
  }
  return payload.idToken;
}

async function post(path: string, body: Record<string, unknown>, token?: string) {
  return fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: {
      origin: apiBase,
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function emulatorDocument(path: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(
    `http://127.0.0.1:8080/v1/projects/demo-imi-playwright/databases/(default)/documents/${path}`,
    { headers: { authorization: 'Bearer owner' } },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore Emulator read failed: ${response.status}`);
  return await response.json() as Record<string, unknown>;
}

async function emulatorCollectionCount(path: string): Promise<number> {
  const response = await fetch(
    `http://127.0.0.1:8080/v1/projects/demo-imi-playwright/databases/(default)/documents/${path}?pageSize=1000`,
    { headers: { authorization: 'Bearer owner' } },
  );
  if (!response.ok) throw new Error(`Firestore Emulator list failed: ${response.status}`);
  const payload = await response.json() as { documents?: unknown[] };
  return payload.documents?.length ?? 0;
}

test('Next.js server routes reject missing and forged tokens without echoing credentials', async () => {
  const crossOrigin = await fetch(`${apiBase}/api/v1/status`, {
    method: 'POST',
    headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'should not be written' }),
  });
  expect(crossOrigin.status).toBe(403);

  const missing = await fetch(`${apiBase}/api/v1/status`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'should not be written' }),
  });
  expect(missing.status).toBe(401);

  const forgedToken = 'eyJhbGciOiJub25lIn0.eyJ1aWQiOiJhdHRhY2tlciJ9.forged-secret-fragment';
  const forged = await post('/api/v1/status', { text: 'should not be written' }, forgedToken);
  expect(forged.status).toBe(401);
  const body = await forged.text();
  expect(body).not.toContain(forgedToken);
  expect(body).not.toContain('private_key');
});

test('authenticated Next.js routes create a status, friend request and direct conversation in Emulator', async () => {
  const suffix = fixtureSuffix(test.info().project.name, test.info().retry);
  const token = await idToken(`e2e-b-${suffix}@imi.test`);

  const status = await post('/api/v1/status', { text: 'اختبار المسارات الخلفية عبر المحاكي' }, token);
  expect(status.status).toBe(200);
  const statusPayload = await status.json() as { ok: boolean; data: { statusId: string; expiresAtMillis: number; mediaPath: null } };
  expect(statusPayload.ok).toBe(true);
  expect(statusPayload.data.statusId).toBeTruthy();
  expect(statusPayload.data.mediaPath).toBeNull();
  expect(statusPayload.data.expiresAtMillis).toBeGreaterThan(Date.now());

  const targetUid = `imi-e2e-f-${suffix}`;
  const friend = await post('/api/v1/friends/requests', { toUid: targetUid }, token);
  expect(friend.status).toBe(200);
  const friendPayload = await friend.json() as { ok: boolean; data: { status: string; requestId: string } };
  expect(friendPayload.data.status).toBe('pending');
  expect(friendPayload.data.requestId).toBeTruthy();

  const conversation = await post('/api/v1/conversations/direct', { otherUid: targetUid }, token);
  expect(conversation.status).toBe(200);
  const conversationPayload = await conversation.json() as { ok: boolean; data: { conversationId: string } };
  expect(conversationPayload.data.conversationId).toMatch(/^direct_[a-f0-9]{64}$/);
});

test('friend request accept, reject and remove routes enforce ownership and reciprocal state', async () => {
  const suffix = fixtureSuffix(test.info().project.name, test.info().retry);
  const recipientToken = await idToken(`e2e-b-${suffix}@imi.test`);
  const recipientUid = `imi-e2e-b-${suffix}`;
  const senderUid = `imi-e2e-a-${suffix}`;
  const rejectSenderUid = `imi-e2e-d-${suffix}`;
  const requestId = `${senderUid}__${recipientUid}`;
  const rejectRequestId = `${rejectSenderUid}__${recipientUid}`;

  const accepted = await post('/api/v1/friends/requests/accept', { requestId }, recipientToken);
  expect(accepted.status).toBe(200);
  expect((await accepted.json()).data.status).toBe('accepted');

  const removed = await post('/api/v1/friends/remove', { friendUid: senderUid }, recipientToken);
  expect(removed.status).toBe(200);
  expect((await removed.json()).data.status).toBe('removed');

  const rejected = await post('/api/v1/friends/requests/reject', { requestId: rejectRequestId }, recipientToken);
  expect(rejected.status).toBe(200);
  expect((await rejected.json()).data.status).toBe('rejected');
});


test('group and block lifecycle routes enforce friendship, admin and bilateral safety rules', async () => {
  const suffix = fixtureSuffix(test.info().project.name, test.info().retry);
  const actorUid = `imi-e2e-g-${suffix}`;
  const actorToken = await idToken(`e2e-g-${suffix}@imi.test`);
  const dUid = `imi-e2e-h-${suffix}`;
  const eUid = `imi-e2e-i-${suffix}`;
  const fUid = `imi-e2e-j-${suffix}`;

  const created = await post('/api/v1/conversations/groups', {
    name: 'مجموعة اختبار E2E',
    participantUids: [dUid, eUid],
  }, actorToken);
  expect(created.status).toBe(200);
  const createdPayload = await created.json() as { data: { conversationId: string; participantCount: number } };
  expect(createdPayload.data.participantCount).toBe(3);

  const added = await post('/api/v1/conversations/groups/members', {
    conversationId: createdPayload.data.conversationId,
    participantUids: [fUid],
  }, actorToken);
  expect(added.status).toBe(200);
  expect((await added.json()).data.participantCount).toBe(4);

  const blocked = await post('/api/v1/users/block', { targetUid: dUid }, actorToken);
  expect(blocked.status).toBe(200);
  expect((await blocked.json()).data.status).toBe('blocked');

  const unblocked = await post('/api/v1/users/unblock', { targetUid: dUid }, actorToken);
  expect(unblocked.status).toBe(200);
  expect((await unblocked.json()).data.status).toBe('unblocked');

  // Blocking is not an implicit friend request: the reciprocal friendship remains removed.
  const cannotCreateDirect = await post('/api/v1/conversations/direct', { otherUid: dUid }, actorToken);
  expect(cannotCreateDirect.status).toBe(200);
  const newFriend = await post('/api/v1/friends/requests', { toUid: dUid }, actorToken);
  expect(newFriend.status).toBe(200);
  expect((await newFriend.json()).data.status).toBe('pending');
});



test('admin can preview and publish a large curriculum level without publishing nameless nodes or creating lessons', async () => {
  const suffix = fixtureSuffix(test.info().project.name, test.info().retry);
  const adminToken = await idToken(`e2e-admin-${suffix}@imi.test`);
  const userToken = await idToken(`e2e-b-${suffix}@imi.test`);
  const scopeId = `e2e-publish-level-${suffix}`;
  const nestedLevelId = `e2e-publish-nested-level-${suffix}`;
  const namelessId = scopeId + '-subject-nameless';
  const lessonCountBefore = await emulatorCollectionCount('courses/e2e-general-skills/lessons');

  const denied = await post('/api/v1/admin/curriculum/publish', {
    scopeId, dryRun: true,
  }, userToken);
  expect(denied.status).toBe(403);

  const parentBlocked = await post('/api/v1/admin/curriculum/publish', {
    scopeId: nestedLevelId, dryRun: true,
  }, adminToken);
  expect(parentBlocked.status).toBe(400);
  expect((await parentBlocked.json()).error).toContain('العقدة الأب');

  const preview = await post('/api/v1/admin/curriculum/publish', {
    scopeId, dryRun: true,
  }, adminToken);
  expect(preview.status).toBe(200);
  const previewData = (await preview.json()).data as { dryRun: boolean; count: number; byType: Record<string, number> };
  expect(previewData.dryRun).toBe(true);
  expect(previewData.count).toBe(404);
  expect(previewData.byType.unit).toBe(401);

  const rootBefore = await emulatorDocument('curriculumNodes/' + scopeId);
  expect((rootBefore?.fields as Record<string, { stringValue?: string }>).status.stringValue).toBe('hidden');

  const published = await post('/api/v1/admin/curriculum/publish', {
    scopeId, dryRun: false, confirmation: 'PUBLISH',
  }, adminToken);
  expect(published.status).toBe(200);
  const publishedData = (await published.json()).data as { dryRun: boolean; count: number };
  expect(publishedData.dryRun).toBe(false);
  expect(publishedData.count).toBe(404);

  const rootAfter = await emulatorDocument('curriculumNodes/' + scopeId);
  expect((rootAfter?.fields as Record<string, { stringValue?: string }>).status.stringValue).toBe('published');
  const nameless = await emulatorDocument('curriculumNodes/' + namelessId);
  expect(nameless).not.toBeNull();
  expect((nameless?.fields as Record<string, { stringValue?: string }>).status.stringValue).toBe('hidden');

  const secondPreview = await post('/api/v1/admin/curriculum/publish', {
    scopeId, dryRun: true,
  }, adminToken);
  expect(secondPreview.status).toBe(200);
  expect((await secondPreview.json()).data.count).toBe(0);
  expect(await emulatorCollectionCount('courses/e2e-general-skills/lessons')).toBe(lessonCountBefore);
});

test('Reels API validates submissions and keeps moderation admin-only', async () => {
  const suffix = fixtureSuffix(test.info().project.name, test.info().retry);
  const token = await idToken(`e2e-b-${suffix}@imi.test`);

  const invalidSubmission = await post('/api/v1/reels/submit', {
    reelId: 'bad',
    caption: 'invalid fixture',
    storagePath: 'reels/attacker/bad/video.mp4',
    contentType: 'video/mp4',
  }, token);
  expect(invalidSubmission.status).toBe(400);

  const nonAdminReview = await post('/api/v1/reels/review', {
    reelId: 'imi-reel-e2e-0001',
    decision: 'approved',
  }, token);
  expect(nonAdminReview.status).toBe(403);

  const missingAuth = await post('/api/v1/reels/review', {
    reelId: 'imi-reel-e2e-0001',
    decision: 'approved',
  });
  expect(missingAuth.status).toBe(401);
});



test('admin health probe is opt-in, requires a verified admin and reads the seeded Firestore document', async () => {
  const suffix = fixtureSuffix(test.info().project.name, test.info().retry);
  const adminToken = await idToken(`e2e-admin-${suffix}@imi.test`);
  const userToken = await idToken(`e2e-b-${suffix}@imi.test`);

  const denied = await fetch(`${apiBase}/api/v1/health/admin`, {
    headers: { authorization: `Bearer ${userToken}` },
  });
  expect(denied.status).toBe(403);

  const missing = await fetch(`${apiBase}/api/v1/health/admin`);
  expect(missing.status).toBe(401);

  const success = await fetch(`${apiBase}/api/v1/health/admin`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  expect(success.status).toBe(200);
  expect(await success.json()).toMatchObject({
    status: 'ok', service: 'imi-admin-api', firestoreRead: true,
  });
});

test('teacher applications use HTTPS proof links, published curriculum and admin-only idempotent review', async () => {
  const suffix = fixtureSuffix(test.info().project.name, test.info().retry);
  const applicantUid = `imi-e2e-b-${suffix}`;
  const applicantToken = await idToken(`e2e-b-${suffix}@imi.test`);
  const httpAttemptToken = await idToken(`e2e-d-${suffix}@imi.test`);
  const credentialAttemptToken = await idToken(`e2e-e-${suffix}@imi.test`);
  const unpublishedAttemptToken = await idToken(`e2e-f-${suffix}@imi.test`);
  const adminToken = await idToken(`e2e-admin-${suffix}@imi.test`);
  const payload = {
    fullName: 'أستاذة اختبار واجهة الخادم',
    proofUrl: 'https://drive.google.com/file/d/imi-e2e-proof/view',
    subjectIds: ['e2e-primary-math'],
    levelIds: ['e2e-primary'],
  };

  const httpLink = await post('/api/v1/teachers/applications', {
    ...payload, proofUrl: 'http://example.com/proof',
  }, httpAttemptToken);
  expect(httpLink.status).toBe(400);

  const credentialLink = await post('/api/v1/teachers/applications', {
    ...payload, proofUrl: 'https://user:password@example.com/proof',
  }, credentialAttemptToken);
  expect(credentialLink.status).toBe(400);

  const unpublished = await post('/api/v1/teachers/applications', {
    ...payload, subjectIds: ['e2e-unpublished-subject'],
  }, unpublishedAttemptToken);
  expect(unpublished.status).toBe(409);

  const submitted = await post('/api/v1/teachers/applications', payload, applicantToken);
  expect(submitted.status).toBe(200);
  expect((await submitted.json()).data.status).toBe('pending');

  const duplicate = await post('/api/v1/teachers/applications', payload, applicantToken);
  expect(duplicate.status).toBe(409);

  const denied = await post('/api/v1/admin/teachers/review', {
    uid: applicantUid, approved: true,
  }, applicantToken);
  expect(denied.status).toBe(403);

  const approved = await post('/api/v1/admin/teachers/review', {
    uid: applicantUid, approved: true, note: 'تم التحقق من الرابط يدوياً في اختبار المحاكي',
  }, adminToken);
  expect(approved.status).toBe(200);
  expect((await approved.json()).data).toMatchObject({ status: 'approved', claimsSync: 'applied' });

  const repeated = await post('/api/v1/admin/teachers/review', {
    uid: applicantUid, approved: true,
  }, adminToken);
  expect(repeated.status).toBe(200);
  expect((await repeated.json()).data.status).toBe('approved');

  const refreshedToken = await idToken(`e2e-b-${suffix}@imi.test`);
  const claims = JSON.parse(Buffer.from(refreshedToken.split('.')[1], 'base64url').toString('utf8')) as {
    teacher?: boolean; teacherVerified?: boolean;
  };
  expect(claims.teacher).toBe(true);
  expect(claims.teacherVerified).toBe(true);

  const stored = await emulatorDocument('teacherApplications/' + applicantUid);
  const fields = stored?.fields as Record<string, { stringValue?: string }>;
  expect(fields.status.stringValue).toBe('approved');
  expect(fields.proofUrl.stringValue).toBe(payload.proofUrl);
  expect(fields.evidencePath).toBeUndefined();
});


test('teacher approval remains approved after Auth sync failure and same-decision retry applies claims', async () => {
  const suffix = fixtureSuffix(test.info().project.name, test.info().retry);
  const adminToken = await idToken(`e2e-admin-${suffix}@imi.test`);
  const targetUid = `imi-e2e-claim-retry-${suffix}`;
  const email = `e2e-claim-retry-${suffix}@imi.test`;
  await adminDb.doc(`teacherApplications/${targetUid}`).set({
    uid: targetUid,
    fullName: 'أستاذ اختبار إعادة مزامنة الصلاحيات',
    proofUrl: 'https://drive.google.com/file/d/retry-proof/view',
    subjectIds: ['e2e-primary-math'],
    levelIds: ['e2e-primary'],
    status: 'pending',
    submittedAt: new Date(),
  });

  await adminAuth.createUser({
    uid: targetUid, email, password, emailVerified: true,
  });
  // Existing claims are valid alone, but adding teacher roles exceeds Firebase's
  // 1000-byte custom-claims limit and forces setCustomUserClaims to fail after approval.
  await adminAuth.setCustomUserClaims(targetUid, { padding: 'x'.repeat(950) });
  const firstAttempt = await post('/api/v1/admin/teachers/review', {
    uid: targetUid, approved: true,
  }, adminToken);
  expect(firstAttempt.status).toBe(503);
  expect((await adminDb.doc(`teacherApplications/${targetUid}`).get()).get('status')).toBe('approved');
  expect((await adminDb.doc(`teacherClaimsOutbox/teacher-application-${targetUid}-approved`).get()).get('status')).toBe('pending');

  // Remove the oversized unrelated claim, then retry the same decision.
  await adminAuth.setCustomUserClaims(targetUid, {});
  const retry = await post('/api/v1/admin/teachers/review', {
    uid: targetUid, approved: true,
  }, adminToken);
  expect(retry.status).toBe(200);
  expect((await retry.json()).data).toMatchObject({ status: 'approved', claimsSync: 'applied' });
  expect((await adminDb.doc(`teacherClaimsOutbox/teacher-application-${targetUid}-approved`).get()).get('status')).toBe('applied');

  const refreshed = await idToken(email);
  const claims = JSON.parse(Buffer.from(refreshed.split('.')[1], 'base64url').toString('utf8')) as {
    teacher?: boolean; teacherVerified?: boolean;
  };
  expect(claims.teacher).toBe(true);
  expect(claims.teacherVerified).toBe(true);
});
