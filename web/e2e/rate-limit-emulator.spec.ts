import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = 'demo-imi-playwright';
const authEmulator = 'http://127.0.0.1:9099';
const apiBase = 'http://127.0.0.1:3000';
const password = 'IMI-RateLimit-Emulator-2026!';
const adminApp = getApps().find(app => app.name === 'imi-rate-limit-e2e')
  ?? initializeApp({ projectId }, 'imi-rate-limit-e2e');
const auth = getAuth(adminApp);
const db = getFirestore(adminApp);

test('Firestore Emulator rate limit is atomic under concurrent authenticated API requests', async () => {
  const suffix = `${test.info().project.name.replace(/[^a-z0-9]/gi, '-')}-retry${test.info().retry}`;
  const uid = `imi-rate-${suffix}`;
  const email = `${uid}@imi.test`;

  await auth.createUser({ uid, email, password });
  const signIn = await fetch(
    `${authEmulator}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  expect(signIn.status).toBe(200);
  const { idToken } = await signIn.json() as { idToken: string };

  const responses = await Promise.all(Array.from({ length: 8 }, () =>
    fetch(`${apiBase}/api/v1/status`, {
      method: 'POST',
      headers: {
        origin: apiBase,
        'content-type': 'application/json',
        authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ text: 'اختبار التزامن عبر Firestore Emulator' }),
    }),
  ));

  const statuses = responses.map(response => response.status);
  expect(statuses.filter(status => status === 200)).toHaveLength(2);
  expect(statuses.filter(status => status === 429)).toHaveLength(6);
  expect(statuses.every(status => status === 200 || status === 429)).toBe(true);

  const key = createHash('sha256').update(`createStatus:${uid}`).digest('hex');
  const counter = await db.doc(`apiRateLimits/${key}`).get();
  expect(counter.exists).toBe(true);
  expect(counter.get('operation')).toBe('createStatus');
  expect(counter.get('uidHash')).toBe(key);
  expect(counter.get('windows.window.count')).toBe(2);
});
