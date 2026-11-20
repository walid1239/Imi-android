import { expect, test, type Page } from '@playwright/test';

const password = 'IMI-Emulator-Password-2026!';
const suffix = (project: string) => project.includes('mobile') ? 'mobile' : 'desktop';
const email = (role: 'a' | 'b' | 'c' | 'd' | 'admin', project: string) => `e2e-${role}-${suffix(project)}@imi.test`;

async function login(page: Page, address: string) {
  await page.goto('/login');
  await page.getByLabel('البريد الإلكتروني').fill(address);
  await page.getByLabel('كلمة المرور').fill(password);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 15000 });
}

test('public academy can be browsed without an account in Arabic RTL', async ({ page }) => {
  await page.goto('/academy');
  await expect(page.getByRole('heading', { name: 'تعلّم وتقدّم' })).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'مهارة التعلم الذاتي' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ابدأ من مستواك، وتقدّم خطوة بخطوة' })).toBeVisible();
  await expect(page.getByLabel('المستوى')).toBeVisible();
  await page.getByLabel('المستوى').selectOption('e2e-primary');
  await page.getByLabel('الشعبة أو المسلك').selectOption('e2e-primary-track');
  await expect(page.getByRole('button', { name: /الرياضيات - اختبار/ })).toBeVisible();
  await page.getByRole('button', { name: /الرياضيات - اختبار/ }).click();
  await expect(page.getByText('لا دروس بعد. سيضيفها أساتذتنا قريباً')).toBeVisible();
  await expect(page.getByRole('link', { name: 'تسجيل الدخول لحفظ التقدم سحابياً' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'أصبح أستاذاً' })).toBeVisible();
});

test('phone OTP validates the selected country number before requesting SMS', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('الدخول برقم الهاتف (OTP)')).toBeVisible();
  await expect(page.getByLabel('الدولة')).toHaveValue('+212');
  await page.getByLabel('رقم الهاتف').fill('12345');
  await page.getByRole('button', { name: 'إرسال رمز التحقق' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('أدخل 9 أرقام بعد رمز الدولة.');
});

test('two learners can befriend each other, exchange a message and publish a status', async ({ page, browser }) => {
  const project = test.info().project.name;
  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  try {
    await login(page, email('a', project));
    await login(secondPage, email('b', project));

    await page.getByRole('button', { name: /الأصدقاء/ }).first().click();
    await page.getByPlaceholder('اكتب حرفين على الأقل من الاسم…').fill('تلميذ باء');
    await expect(page.getByText('تلميذ باء')).toBeVisible();
    await page.getByRole('button', { name: 'إضافة' }).click();
    await expect(page.getByRole('status')).toContainText('أُرسل طلب الصداقة');

    await secondPage.getByRole('button', { name: /الأصدقاء/ }).first().click();
    await expect(secondPage.getByText(/طلبات الصداقة الواردة/)).toBeVisible();
    await secondPage.getByRole('button', { name: 'قبول' }).click();
    await expect(secondPage.getByRole('status')).toContainText('تم قبول طلب الصداقة');

    await page.getByRole('button', { name: /المحادثات/ }).first().click();
    await page.getByPlaceholder('ابحث بالاسم…').fill('تلميذ باء');
    await page.getByRole('button', { name: 'بحث عن مستخدمين' }).click();
    await expect(page.getByText('تلميذ باء')).toBeVisible();
    await page.getByRole('button', { name: 'مراسلة' }).click();
    await page.getByPlaceholder('اكتب رسالتك…').fill('رسالة اختبار من IMI');
    await page.getByRole('button', { name: 'إرسال' }).click();
    await expect(page.getByText('رسالة اختبار من IMI')).toBeVisible();

    await secondPage.getByRole('button', { name: /المحادثات/ }).first().click();
    await expect(secondPage.getByText('رسالة اختبار من IMI')).toBeVisible({ timeout: 15000 });

    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'حظر المستخدم' }).click();
    await expect(page.getByRole('status')).toContainText('تم حظر المستخدم وإيقاف المحادثة المباشرة');

    await page.getByPlaceholder('ابحث بالاسم…').fill('تلميذ جيم');
    await page.getByRole('button', { name: 'بحث عن مستخدمين' }).click();
    await page.getByRole('button', { name: 'للمجموعة' }).click();
    await page.getByPlaceholder('ابحث بالاسم…').fill('تلميذ دال');
    await page.getByRole('button', { name: 'بحث عن مستخدمين' }).click();
    await page.getByRole('button', { name: 'للمجموعة' }).click();
    await page.getByPlaceholder('اسم المجموعة').fill('مجموعة اختبار');
    await page.getByRole('button', { name: 'إنشاء مجموعة (3 أعضاء على الأقل)' }).click();
    await expect(page.getByRole('heading', { name: 'مجموعة اختبار' })).toBeVisible();
    await page.getByPlaceholder('اكتب رسالتك…').fill('رسالة داخل مجموعة');
    await page.getByRole('button', { name: 'إرسال' }).click();
    await expect(page.getByText('رسالة داخل مجموعة')).toBeVisible();

    await page.getByRole('button', { name: /الحالات/ }).first().click();
    await page.getByPlaceholder('ماذا تريد أن تشارك؟').fill('حالة اختبار من IMI');
    await page.getByRole('button', { name: 'نشر الحالة' }).click();
    await expect(page.getByRole('status')).toContainText('نُشرت حالتك');
  } finally {
    await secondContext.close();
  }
});

test('learner can enroll in a general-skills course and complete its lesson', async ({ page }) => {
  await login(page, email('a', test.info().project.name));
  await page.getByRole('button', { name: /الأكاديمية/ }).first().click();
  await expect(page.getByText('مهارة التعلم الذاتي')).toBeVisible();
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
  await login(page, email('admin', test.info().project.name));
  await expect(page.getByRole('button', { name: /إدارة الأكاديمية/ })).toBeVisible();
  await page.getByRole('button', { name: /إدارة الأكاديمية/ }).first().click();
  await expect(page.getByRole('heading', { name: 'إدارة الأكاديمية' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'إدارة شجرة المنهاج' })).toBeVisible();
  const variant = suffix(test.info().project.name);
  const teacherUid = 'imi-e2e-a-' + variant;
  const contentTitle = 'درس أستاذ اختبار منشور ' + variant;
  await expect(page.getByText(contentTitle)).toBeVisible();
  await page.locator('article').filter({ hasText: contentTitle }).getByRole('button', { name: 'اعتماد ونشر' }).click();
  await expect(page.getByRole('status')).toContainText('تم نشر المحتوى بعد المراجعة');
  await page.locator('article').filter({ hasText: teacherUid }).getByRole('button', { name: 'اعتماد التوثيق' }).click();
  await expect(page.getByRole('status')).toContainText('تم اعتماد الطلب ومنح صلاحية الأستاذ الموثق');
});



test('verified teachers cannot start private student chats or mixed private groups', async ({ page }) => {
  await login(page, email('c', test.info().project.name));
  await page.goto('/messages');
  await page.getByPlaceholder('ابحث بالاسم…').fill('تلميذ جيم');
  await page.getByRole('button', { name: 'بحث عن مستخدمين' }).click();
  await page.getByRole('button', { name: 'مراسلة' }).click();
  await expect(page.getByRole('alert')).toContainText('التواصل الخاص بين الأستاذ والتلميذ غير متاح');
  await page.getByRole('button', { name: 'للمجموعة' }).click();
  await page.getByPlaceholder('ابحث بالاسم…').fill('تلميذ دال');
  await page.getByRole('button', { name: 'بحث عن مستخدمين' }).click();
  await page.getByRole('button', { name: 'للمجموعة' }).click();
  await page.getByPlaceholder('اسم المجموعة').fill('مجموعة مختلطة ممنوعة');
  await page.getByRole('button', { name: 'إنشاء مجموعة (3 أعضاء على الأقل)' }).click();
  await expect(page.getByRole('alert')).toContainText('المجموعات الخاصة بين الأساتذة والتلاميذ غير متاحة');
});

test('approved teacher content appears under its curriculum subject', async ({ page }) => {
  await page.goto('/academy');
  await page.getByLabel('المستوى').selectOption('e2e-primary');
  await page.getByLabel('الشعبة أو المسلك').selectOption('e2e-primary-track');
  await page.getByRole('button', { name: /الرياضيات - اختبار/ }).click();
  const contentTitle = 'درس أستاذ اختبار منشور ' + suffix(test.info().project.name);
  await expect(page.getByText(contentTitle)).toBeVisible();
  await expect(page.getByText(/هذا نص تجريبي طويل بما يكفي/)).toBeVisible();
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
  await expect(page.getByRole('button', { name: 'حذف الحساب نهائياً' })).toBeDisabled();
});

test('login exposes country-aware phone OTP with local E.164 validation', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'الدخول برقم الهاتف (OTP)' })).toBeVisible();
  await expect(page.getByLabel('الدولة')).toBeVisible();
  await expect(page.getByLabel('رقم الهاتف')).toBeVisible();
  await page.getByLabel('رقم الهاتف').fill('061234567');
  await page.getByRole('button', { name: 'إرسال رمز التحقق' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('أدخل 9 أرقام بعد رمز الدولة');
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
