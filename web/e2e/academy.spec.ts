import { expect, test, type Page } from '@playwright/test';

const password = 'IMI-Emulator-Password-2026!';
const suffix = (project: string) => project.includes('mobile') ? 'mobile' : 'desktop';
const email = (role: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'admin', project: string) => `e2e-${role}-${suffix(project)}@imi.test`;

async function login(page: Page, address: string) {
  await page.goto('/login');
  await page.getByLabel('البريد الإلكتروني').fill(address);
  await page.getByLabel('كلمة المرور').fill(password);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  try {
    await expect(page).toHaveURL(/\/app$/, { timeout: 15000 });
  } catch {
    const messages = await page.locator('[role="status"], [role="alert"]').allTextContents();
    throw new Error(`Login did not reach /app. Visible Firebase/auth messages: ${messages.join(' | ') || 'none'}`);
  }
}

test('public academy can be browsed without an account in Arabic RTL', async ({ page }) => {
  const response = await page.goto('/academy');
  console.log('E2E academy response', response?.status(), page.url(), (await page.locator('body').innerText().catch(() => '')).slice(0, 500));
  await expect(response).not.toBeNull();
  await expect(page.getByRole('heading', { name: 'ابدأ من مستواك، وتقدّم خطوة بخطوة' })).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('dir', 'rtl');
  await expect.poll(async () => {
    const courseVisible = await page.getByRole('heading', { name: 'مهارة التعلم الذاتي' }).isVisible().catch(() => false);
    const errorVisible = await page.locator('[role="alert"]').first().isVisible().catch(() => false);
    return courseVisible || errorVisible;
  }, { timeout: 15000 }).toBe(true);
  if (await page.locator('[role="alert"]').first().isVisible().catch(() => false)) {
    throw new Error('Public academy Firebase read failed: ' + await page.locator('[role="alert"]').first().innerText());
  }
  await expect(page.getByRole('heading', { name: 'مهارة التعلم الذاتي' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ابدأ من مستواك، وتقدّم خطوة بخطوة' })).toBeVisible();
  await expect(page.getByLabel('المستوى')).toBeVisible();
  await page.getByLabel('المستوى').selectOption('e2e-primary');
  await page.getByLabel('الشعبة أو المسلك').selectOption('e2e-primary-track');
  await expect(page.getByRole('button', { name: /الرياضيات - اختبار/ })).toBeVisible();
  await page.getByRole('button', { name: /الرياضيات - اختبار/ }).click();
  await expect(page.getByRole('heading', { name: 'الرياضيات - اختبار' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'تسجيل الدخول لحفظ التقدم سحابياً' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'أصبح أستاذاً' })).toBeVisible();
});

test('two learners can befriend each other, exchange a message and publish a status', async ({ page, browser }) => {
  const project = test.info().project.name;
  const fixtureBase = suffix(project);
  const fixture = test.info().retry > 0 ? `${fixtureBase}-retry${test.info().retry}` : fixtureBase;
  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  try {
    await login(page, `e2e-a-${fixture}@imi.test`);
    await login(secondPage, `e2e-f-${fixture}@imi.test`);

    await page.getByRole('button', { name: /الأصدقاء/ }).first().click();
    await page.getByPlaceholder('اكتب حرفين على الأقل من الاسم…').fill('تلميذ فاء ' + fixture);
    await expect(page.getByText('تلميذ فاء ' + fixture).first()).toBeVisible();
    const addFriend = page.getByTestId('add-friend-imi-e2e-f-' + fixture);
    await expect(addFriend).toBeVisible();
    await expect(addFriend).toBeEnabled();
    await addFriend.click();
    await expect(page.getByRole('status')).toContainText('أُرسل طلب الصداقة');

    await secondPage.getByRole('button', { name: /الأصدقاء/ }).first().click();
    await expect(secondPage.getByText(/طلبات الصداقة الواردة/)).toBeVisible();
    await secondPage.getByRole('button', { name: 'قبول' }).click();
    await expect(secondPage.getByRole('status')).toContainText('تم قبول طلب الصداقة');

    await page.getByRole('button', { name: /المحادثات/ }).first().click();
    await page.getByPlaceholder('ابحث بالاسم…').fill('تلميذ فاء ' + fixture);
    await page.getByRole('button', { name: 'بحث عن مستخدمين' }).click();
    await expect(page.getByText('تلميذ فاء ' + fixture, { exact: true })).toBeVisible()
    await page.getByTestId('start-chat-imi-e2e-f-' + fixture).click();
    await page.getByPlaceholder('اكتب رسالتك…').fill('رسالة اختبار من IMI');
    await page.getByRole('button', { name: 'إرسال' }).click();
    await expect(page.locator('article').getByText('رسالة اختبار من IMI')).toBeVisible();

    await secondPage.getByRole('button', { name: /المحادثات/ }).first().click();
    await expect(secondPage.locator('article').getByText('رسالة اختبار من IMI')).toBeVisible({ timeout: 15000 });

    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'حظر المستخدم' }).click();
    await expect(page.getByRole('status')).toContainText('تم حظر المستخدم وإيقاف المحادثة المباشرة');

    await page.getByPlaceholder('ابحث بالاسم…').fill('تلميذ هاء ' + fixture);
    await page.getByRole('button', { name: 'بحث عن مستخدمين' }).click();
    await page.getByTestId('toggle-group-member-imi-e2e-e-' + fixture).click();
    await page.getByPlaceholder('ابحث بالاسم…').fill('تلميذ دال ' + fixture);
    await page.getByRole('button', { name: 'بحث عن مستخدمين' }).click();
    await page.getByTestId('toggle-group-member-imi-e2e-d-' + fixture).click();
    await page.getByPlaceholder('اسم المجموعة').fill('مجموعة اختبار');
    await page.getByRole('button', { name: 'إنشاء مجموعة (3 أعضاء على الأقل)' }).click();
    await expect(page.getByRole('heading', { name: 'مجموعة اختبار' })).toBeVisible();
    await page.getByPlaceholder('اكتب رسالتك…').fill('رسالة داخل مجموعة');
    await page.getByRole('button', { name: 'إرسال' }).click();
    await expect(page.locator('article').getByText('رسالة داخل مجموعة')).toBeVisible();

    await page.getByRole('button', { name: /الحالات/ }).first().click();
    await page.getByPlaceholder('ماذا تريد أن تشارك؟').fill('حالة اختبار من IMI');
    await page.getByRole('button', { name: 'نشر الحالة' }).click();
    await expect(page.getByRole('status')).toContainText('نُشرت حالتك');
  } finally {
    await secondContext.close();
  }
});

test('learner can enroll in a general-skills course and complete its lesson', async ({ page }) => {
  const project = test.info().project.name;
  const fixture = test.info().retry > 0 ? `${suffix(project)}-retry${test.info().retry}` : suffix(project);
  await login(page, `e2e-a-${fixture}@imi.test`);
  await page.getByRole('button', { name: /الأكاديمية/ }).first().click();
  await expect(page.getByText('مهارة التعلم الذاتي').first()).toBeVisible();
  await page.getByRole('button', { name: 'سجّل في هذه الدورة' }).click();
  await expect(page.getByText(/تقدمك في الدورة/)).toBeVisible();
  await page.getByRole('button', { name: /مهارة التعلم الذاتي/ }).click();
  await expect(page.getByRole('heading', { name: 'خطوات عملية لبناء عادة تعلم مستمرة' })).toBeVisible();
  await page.getByRole('button', { name: 'وضع علامة: أكملت الدرس' }).click();
  await expect(page.getByRole('status')).toContainText('تم تسجيل إكمال الدرس');
  await page.getByRole('button', { name: 'الإبلاغ عن الدرس' }).click();
  await page.getByLabel('سبب البلاغ').selectOption('incorrect');
  await page.getByPlaceholder('تفاصيل إضافية (اختياري)').fill('ملاحظة اختبار آلية');
  await page.getByRole('button', { name: 'إرسال البلاغ' }).click();
  await expect(page.getByRole('status')).toContainText('تم إرسال البلاغ إلى فريق الإشراف');
});

test('admin claim exposes the protected Academy administration panel', async ({ page }) => {
  const project = test.info().project.name;
  const fixture = test.info().retry > 0 ? `${suffix(project)}-retry${test.info().retry}` : suffix(project);
  await login(page, `e2e-admin-${fixture}@imi.test`);
  await expect(page.getByRole('button', { name: /إدارة الأكاديمية/ }).first()).toBeVisible();
  await page.getByRole('button', { name: /إدارة الأكاديمية/ }).first().click();
  await expect(page.getByRole('heading', { name: 'إدارة الأكاديمية' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'إدارة شجرة المنهاج' })).toBeVisible();
  const teacherUid = 'imi-e2e-a-' + fixture;
  const contentTitle = 'درس أستاذ اختبار منشور ' + fixture;
  await expect(page.getByText(contentTitle, { exact: true })).toBeVisible();
  await page.locator('article').filter({ has: page.getByText(contentTitle, { exact: true }) }).getByRole('button', { name: 'اعتماد ونشر' }).click();
  await expect(page.getByRole('status')).toContainText('تم نشر المحتوى بعد المراجعة');
  await page.locator('article').filter({ has: page.getByText('UID: ' + teacherUid, { exact: true }) }).getByRole('button', { name: 'اعتماد التوثيق' }).click();
  await expect(page.getByRole('status')).toContainText('تم اعتماد الطلب ومنح صلاحية الأستاذ الموثق');
});



test('verified teachers cannot start private student chats or mixed private groups', async ({ page }) => {
  await login(page, email('c', test.info().project.name));
  await page.goto('/app');
  await page.getByRole('button', { name: /المحادثات/ }).first().click();
  await page.getByPlaceholder('ابحث بالاسم…').fill('تلميذ باء ' + suffix(test.info().project.name));
  await page.getByRole('button', { name: 'بحث عن مستخدمين' }).click();
  await page.getByTestId('start-chat-imi-e2e-b-' + suffix(test.info().project.name)).click();
  await expect(page.locator('p[role="alert"]')).toContainText('التواصل الخاص بين الأستاذ والتلميذ غير متاح');
  await page.getByTestId('toggle-group-member-imi-e2e-b-' + suffix(test.info().project.name)).click();
  await page.getByPlaceholder('ابحث بالاسم…').fill('تلميذ ألف ' + suffix(test.info().project.name));
  await page.getByRole('button', { name: 'بحث عن مستخدمين' }).click();
  await page.getByTestId('toggle-group-member-imi-e2e-a-' + suffix(test.info().project.name)).click();
  await page.getByPlaceholder('اسم المجموعة').fill('مجموعة مختلطة ممنوعة');
  await page.getByRole('button', { name: 'إنشاء مجموعة (3 أعضاء على الأقل)' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('المجموعات الخاصة بين الأساتذة والتلاميذ غير متاحة');
});

test('approved teacher content appears under its curriculum subject', async ({ page }) => {
  await page.goto('/academy');
  await page.getByLabel('المستوى').selectOption('e2e-primary');
  await page.getByLabel('الشعبة أو المسلك').selectOption('e2e-primary-track');
  await page.getByRole('button', { name: /الرياضيات - اختبار/ }).click();
  const contentTitle = 'درس أستاذ اختبار منشور ' + suffix(test.info().project.name);
  await expect(page.getByText(contentTitle, { exact: true })).toBeVisible();
  await expect(page.locator('article').filter({ has: page.getByText(contentTitle, { exact: true }) }).getByText(/هذا نص تجريبي طويل بما يكفي/, { exact: false })).toBeVisible();
});

test('teacher application and studio routes explain verification gate', async ({ page }) => {
  await login(page, email('b', test.info().project.name));
  await page.goto('/teacher/apply');
  await expect(page.getByRole('heading', { name: 'طلب الانضمام كأستاذ' })).toBeVisible();
  await expect(page.getByLabel('الاسم الكامل')).toBeVisible();
  await page.goto('/teacher/studio');
  await expect(page.getByText('حسابك غير موثّق كأستاذ')).toBeVisible();
  await expect(page.getByRole('link', { name: 'طلب توثيق' })).toBeVisible();
});

test('guest sessions can be linked to a permanent email account without changing UID', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: /الدخول السريع كضيف/ }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole('button', { name: /ملفي/ }).first().click();
  await expect(page.getByText('تحويل حساب الضيف إلى حساب دائم')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ربط البريد بالحساب الحالي' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'حذف الحساب غير متاح حالياً' })).toBeDisabled();
});

test('login supports email and guest sessions without phone OTP', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('البريد الإلكتروني')).toBeVisible();
  await expect(page.getByRole('button', { name: /الدخول السريع كضيف/ })).toBeVisible();
  await expect(page.getByLabel('رقم الهاتف')).toHaveCount(0);
  await expect(page.getByText('الدخول برقم الهاتف (OTP)')).toHaveCount(0);
});

test('privacy and terms remain visibly marked as drafts', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByText(/مسودة ما قبل الإطلاق/)).toBeVisible();
  await page.goto('/terms');
  await expect(page.getByText(/مسودة ما قبل الإطلاق/)).toBeVisible();
});

test('mobile academy keeps RTL direction without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/academy');
  await expect(page.locator('main')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'تعلّم وتقدّم' })).toBeVisible();
  const width = await page.locator('body').evaluate(element => element.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
});
