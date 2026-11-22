import type { User } from 'firebase/auth';

type ApiEnvelope<T> = { ok?: boolean; data?: T; error?: string };

export async function postAuthenticated<T>(
  user: Pick<User, 'getIdToken'>,
  path: string,
  body: unknown,
): Promise<T> {
  const token = await user.getIdToken();
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
    credentials: 'same-origin',
  });

  let payload: ApiEnvelope<T>;
  try {
    payload = await response.json() as ApiEnvelope<T>;
  } catch {
    throw new Error('تعذّر قراءة استجابة الخادم.');
  }

  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'تعذّر تنفيذ الطلب.');
  }
  if (payload.ok !== true || payload.data === undefined) {
    throw new Error('استجابة الخادم غير مكتملة.');
  }
  return payload.data;
}
