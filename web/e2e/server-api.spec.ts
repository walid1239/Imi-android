import { expect, test } from '@playwright/test';

const authEmulator = 'http://127.0.0.1:9099';
const apiBase = 'http://127.0.0.1:3000';
const password = 'IMI-Emulator-Password-2026!';

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
