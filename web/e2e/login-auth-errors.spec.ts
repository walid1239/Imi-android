import { expect, test } from '@playwright/test';

const cases = [
  {
    firebaseMessage: 'UNAUTHORIZED_DOMAIN',
    expectedArabic: 'عنوان الموقع غير مسموح له باستخدام Firebase Authentication.',
  },
  {
    firebaseMessage: 'CONFIGURATION_NOT_FOUND',
    expectedArabic: 'خدمة تسجيل الدخول في Firebase غير مكتملة الإعداد.',
  },
];

for (const item of cases) {
  test(`login shows Arabic guidance for ${item.firebaseMessage}`, async ({ page }) => {
    await page.route('**/identitytoolkit.googleapis.com/**', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 400, message: item.firebaseMessage },
        }),
      });
    });

    await page.goto('/login');
    await page.getByLabel('البريد الإلكتروني').fill('auth-error-test@imi.test');
    await page.getByLabel('كلمة المرور').fill('IMI-Emulator-Password-2026!');
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

    await expect(page.getByRole('status')).toContainText(item.expectedArabic);
    await expect(page.getByRole('status')).not.toContainText(item.firebaseMessage);
  });
}
