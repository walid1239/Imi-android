# رسالة إعداد المعاينة — المالك

هذه خطوات إعداد لمرة واحدة فقط. بعد ربط Vercel بـ GitHub، يتولى push إلى الفرع `feature/imi-teacher-admin-preview` إنشاء Preview تلقائياً. لا ترسل أي مفتاح أو token إلى أي شخص أو إلى الدردشة.

## أ. Firebase Authentication
1. افتح مشروع `imi-indroid` في Firebase Console.
2. Authentication → Sign-in method.
3. فعّل Anonymous وEmail/Password وGoogle. لا تفعّل OTP أو WhatsApp.

## ب. إعدادات الويب العامة
من Project settings → Your apps اختر تطبيق Web وانسخ القيم الست إلى Vercel Preview:
`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.
يجب أن يكون Project ID هو `imi-indroid`. أضف أيضاً `FIREBASE_PROJECT_ID=imi-indroid`.

## ج. مفتاح Firebase Admin (Preview فقط)
الكود الحالي يتطلب `FIREBASE_SERVICE_ACCOUNT_JSON` بصيغة JSON صالحة فيها `project_id` و`client_email` و`private_key`.
1. من Project settings → Service accounts أنشئ مفتاحاً خاصاً للمشروع الصحيح ونزّل JSON محلياً.
2. حوّل محتواه محلياً إلى سطر واحد (minified).
3. في Vercel → Project → Settings → Environment Variables أضف `FIREBASE_SERVICE_ACCOUNT_JSON` كـ Sensitive وفي Preview فقط.
4. لا تضعه في Production أو Development، ولا GitHub أو Issues أو سجلات أو دردشة.
5. بعد التأكد من حفظ السر، احذف الملف المحلي بأمان. لا تعرض قيمة المتغير عند التحقق.
ملاحظة أمنية: المفتاح طويل العمر؛ WIF أفضل أمنياً لكنه غير مطبق في الكود الحالي. لا تحذف هذا المتغير حتى يكتمل انتقال WIF واختباره في commit منفصل.

## د. ربط المستودع في Vercel
1. Add New → Project → Import `walid1239/Imi-android`.
2. Root Directory = `web`; Framework = Next.js; Node.js = 22.x.
3. اترك Install Command وBuild Command افتراضيين.
4. فعّل **Include source files outside of the Root Directory** لأن التطبيق يستورد ملفات من `functions/src`.
5. عيّن المتغيرات في Preview فقط.
6. عيّن Production Branch إلى `production-disabled` (اسم غير مستخدم) حتى لا يكون main فرع Production. سكربت تجاهل البناء يوقف أي سياق Production ويسمح في Preview بفرعي main وfeature/imi-teacher-admin-preview فقط.
7. لا تنفّذ Deploy إلى Production. بعد الربط، push للفرع المسموح يطلق Preview تلقائياً.

## هـ. Authorized domains
بعد أول رابط Preview، أضف hostname فقط إلى Firebase → Authentication → Settings → Authorized domains.

## و. منح المشرف (مرة واحدة)
على حاسوبك، ثبّت Google Cloud CLI ثم افتح PowerShell:
```powershell
gcloud auth application-default login
gcloud config set project imi-indroid
$env:GCLOUD_PROJECT = "imi-indroid"
$env:IMI_ADMIN_EMAIL = "البريد-المسجل-في-IMI"
node .\functions\scripts\grant-admin.cjs
```
إذا طلب تأكيداً، استخرج UID للحساب المقصود من Firebase Authentication → Users ثم:
```powershell
$env:CONFIRM_GRANT_IMI_ADMIN = "GRANT_ADMIN_TO_UID_الحقيقي"
node .\functions\scripts\grant-admin.cjs
```
يمكن استخدام `IMI_ADMIN_UID` بدلاً من البريد، وليس الاثنين معاً. يجب أن يملك حساب Google المستخدم صلاحية إدارة Firebase Authentication. بعد النجاح سجّل خروج المشرف وادخل مجدداً/جدّد ID token. لا ترسل ADC أو أي token.

## ز. استيراد المنهج ونشر الهيكل
من لوحة المشرف استورد `data/curriculum.json`، راجع المعاينة والعدد، ثم انشر الجذور فقط: `primary`, `lower-secondary`, `upper-secondary`. النشر هرمي ويشمل الأبناء؛ لا تنشر الفروع منفردة. تحقق من /academy.

## ح. قبول المعاينة بالنقر
- افتح الرابط وتأكد أنه Preview.
- افتح `/api/health` وتحقق من 200.
- افتح `/login` وتحقق من ظهور الواجهة العربية.
- افتح `/academy` وتحقق من المنهج.
- اختبر Email/Password وGoogle وGuest.
- اختبر حساب المشرف وحساباً عادياً.
- اختبر محادثة ورسالة وصداقة وحالة بحسابات اختبار.
- لا تعتبر 200 للصفحة إثباتاً لنجاح عمليات Firestore.
- لا تفعّل رفع الملفات/الفيديو قبل إثبات أهلية Storage على Spark.

## ط. نشر قواعد Firestore — بموافقة المالك فقط
بعد اخضرار CI على SHA النهائي ومراجعة diff، وبموافقة صريحة فقط، من PowerShell في جذر المشروع:
```powershell
npx firebase-tools@15.37.0 login
npx firebase-tools@15.37.0 use imi-indroid
npx firebase-tools@15.37.0 deploy --only firestore:rules,firestore:indexes
```
لا تضف functions أو storage. لا ينشر CI قواعد Firebase الحقيقية.

## ي. الأخطاء الشائعة

| الرسالة | الحل |
|---|---|
| `متغير مفقود: FIREBASE_SERVICE_ACCOUNT_JSON` | أضف السر إلى Preview كـ Sensitive فقط. |
| `FIREBASE_SERVICE_ACCOUNT_JSON ليس JSON صالحاً` | أعد النسخ بصيغة JSON minified في سطر واحد. |
| `auth/unauthorized-domain` | أضف hostname إلى Authorized domains. |
| `CONFIGURATION_NOT_FOUND` | فعّل موفر الدخول وراجع إعدادات Web App. |
| `Server credentials are not configured` | راجع وجود متغير Admin في Preview ثم أعد النشر. |
| 403 بلوحة المشرف | تحقق من claim وجدّد ID token. |
| فشل استيراد functions/src | فعّل Include source files outside of the Root Directory. |
| تخطي build | تأكد من الفرع المسموح وأن البيئة Preview وليست Production. |

## حدود صريحة
Firebase Spark فقط. لا Blaze، لا دفع، لا Cloud Functions، لا دمج PR، ولا Production. CI يستخدم Emulators؛ لم يختبر بيانات Firebase الحقيقي أو قواعده أو حسابات المستخدمين الحقيقية.
