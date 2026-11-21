import { expect, test } from '@playwright/test';

test('account deletion endpoint remains disabled unless explicitly enabled', async ({ request }) => {
  const response = await request.post('/api/v1/account/delete', {
    data: { confirmation: 'DELETE' }
  });
  expect(response.status()).toBe(503);
  const body = await response.json();
  expect(body.error).toContain('معطّل افتراضياً');
});
