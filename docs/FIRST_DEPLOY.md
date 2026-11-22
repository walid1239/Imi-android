# IMI — دليل أول إعداد ونشر يدوي (للمالك فقط)

**الحالة: دليل تحضيري فقط. لا يوجد نشر، ولا تسجيل دخول CLI، ولا إنشاء أسرار أو تعديل إعدادات Firebase تم بواسطة هذا المستودع.**

## بوابات إلزامية قبل البدء

- تأكد أن Node.js 22 مثبت محلياً: `node --version`.
- ثبّت JDK 21 أو أحدث لتشغيل Firebase Emulator Suite مع firebase-tools 15.37.0؛ Gradle build Android يبقى على JDK 17 كما هو.
- استخدم مشروع Firebase الصحيح فقط: `imi-indroid`.
- ملفات القفل الثلاثة ملتزمة في المستودع ومولّدة بـ npm 22: `package-lock.json` و`functions/package-lock.json` و`web/package-lock.json`. استخدم `npm ci` ولا تعدّلها يدوياً.
- **تطابق `users/{uid}`:** تسمح القواعد الحالية بحقول الملف الشخصي التي يكتبها Android (`displayName`, `city`, `photoPath`, `bio`, `languages`, `updatedAt`) وتقيّد `photoPath` بمسار الصورة الخاص بالحساب. اختبار Emulator يغطي الآن كتابة الملف النصي وكتابة الصورة بالمسار نفسه الذي يستخدمه Android، ويرفض مسار صورة يعود إلى مستخدم آخر، إضافةً إلى الحماية من تصعيد الصلاحيات. هذا تحقق محلي فقط ولا يثبت نشر القواعد على Firebase الحقيقي.
- لا تغيّر منطقة الدوال إلى `europe-west1` قبل موافقة المالك؛ المنطقة المقترحة لم تُعتمد بعد.

## 1. تثبيت الأدوات والتحقق محلياً

افتح PowerShell في مجلد المستودع:

```powershell
node --version
npm --version
npm ci
npm ci --prefix functions
npm ci --prefix web
```

يجب أن يعرض Node الإصدار 22. إذا غيّرت أي package.json، أعد توليد ملف القفل المقابل باستخدام npm 22، ثم راجع الفرق وشغّل `npm ci`.

## 2. تسجيل الدخول إلى Firebase CLI وتثبيت المشروع المقصود

إصدار CLI المثبت في إعدادات CI هو `firebase-tools@15.37.0`:

```powershell
npx --yes firebase-tools@15.37.0 --version
npx --yes firebase-tools@15.37.0 login
npx --yes firebase-tools@15.37.0 projects:list
npx --yes firebase-tools@15.37.0 use imi-indroid
```

تأكد من أن المشروع النشط هو `imi-indroid` قبل أي أمر نشر. ملف `.firebaserc` يحدد هذا المشروع كـ default فقط؛ لا يمنح صلاحيات ولا ينشر شيئاً.

## 3. Cloud Functions وTURN — خارج المرحلة المجانية

- لا تنشئ `TURN_SECRET` ولا تربط Secret Manager في مرحلة Firebase Spark الحالية.
- تبقى ملفات Cloud Functions القديمة محفوظة في المستودع، لكن لا تُستدعَ ولا تُنشَر في هذه المرحلة. لا تحذفها ولا تشغّل أي أمر نشر لها.
- لا يوجد خادم TURN مستضاف أو مثبت. يبقى WebRTC المعتمد على TURN غير مفعّل؛ لا تضع `TURN_HOST` ولا تدّعِ توفر relay.
- المسارات الموثوقة الجديدة تكون داخل Next.js `/api/v1`، ولا يتطلب هذا المسار نشر Cloud Functions.


## 4. اختبار القواعد محلياً — قبل أي نشر

```powershell
npm run emulators:test
```

ثم شغّل اختبارات Functions:

```powershell
npm test --prefix functions
```

إذا ظهر أن منفذ Emulator مستخدم، أوقف العملية المحلية التي تستخدمه أو غيّر المنفذ في إعدادات Emulator واختبر من جديد. إذا ظهر `Permission denied` في اختبار، لا تتجاوز القاعدة ولا تنشرها؛ حدّد المستند والعملية والـ UID التي فشلت.

### تحقق users/{uid} وأمر نشر القواعد

تتوافق حقول كتابة الملف الشخصي الظاهرة في Android مع allowlist الحالية في `firestore.rules`: تحديث الملف النصي يكتب `displayName`, `city`, `bio`, `languages`, `updatedAt`، وتحديث الصورة يضيف `photoPath` ضمن `users/{uid}/avatars/...`. يجب أن تغطي اختبارات Emulator كلا الشكلين، بما في ذلك تحديث الصورة، قبل اعتماد النتيجة نهائياً.

لا يوجد نشر للقواعد على Firebase الحقيقي ضمن هذه الخطوات. بعد نجاح اختبارات Emulator وموافقة المالك الصريحة فقط، نفّذ من حاسوب المالك:

```bash
npx firebase-tools@15.37.0 login
npx firebase-tools@15.37.0 use imi-indroid
npx firebase-tools@15.37.0 deploy --only firestore:rules,firestore:indexes
```

هذا الأمر ينشر Firestore Rules وIndexes فقط؛ لا ينشر Storage Rules أو Cloud Functions. لا تنفّذه الآن دون موافقة المالك.

## 5. Cloud Functions — محفوظة وغير منشورة

مرحلة IMI الحالية ملتزمة بخطة Firebase Spark فقط. لذلك لا تنفّذ `firebase deploy --only functions` ولا تستدعِ Cloud Functions من العملاء. ملفات الدوال القديمة تبقى محفوظة كما هي لأسباب التوافق والمراجعة، ولا نحذفها. المسارات الخلفية الجديدة تُنفّذ داخل Next.js `/api/v1`. أي انتقال مستقبلي إلى Cloud Functions يتطلب قراراً مستقلاً وموافقة صريحة على خطة Blaze والفوترة، وهو خارج نطاق هذه المرحلة.


## 6. إعداد ونشر الويب — بعد اختيار المضيف

الويب يستخدم Next.js 15 App Router. اختر المضيف أولاً:
- Vercel Hobby: خيار معاينة مجاني فقط إذا كان الاستخدام شخصياً وغير تجاري. شروط Vercel الحالية تقصر Hobby على الاستخدام الشخصي/غير التجاري، وتحتفظ بحق تعطيل أو إزالة المشروع؛ لذلك لا يصلح لاستضافة IMI تجارياً أو مع تحقيق دخل. راجع [شروط Vercel، القسم 4](https://vercel.com/legal/terms).
- Cloudflare Workers: لم يُثبت حتى الآن تشغيل `firebase-admin` مع `verifyIdToken` وكتابة Firestore تحت `nodejs_compat` باختبار موثق؛ لا تعتبره مضيفاً معتمداً ولا تنشر عليه.
- Firebase App Hosting: يتطلب Blaze وربط Cloud Billing؛ لا تستخدمه ما دام شرط Spark قائماً.

المتغيرات العامة المطلوبة موجودة في `web/.env.example`:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_PROJECT_ID=imi-indroid`
- `FIREBASE_SERVICE_ACCOUNT_JSON` — سرّ خادم يوضع في إعدادات Environment Variables على منصة الاستضافة فقط، ولا يُحفظ في المستودع أو السجلات أو المتصفح.
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (اختياري بعد إعداد FCM)
- `NEXT_PUBLIC_STUN_URLS`
- `NEXT_PUBLIC_ICE_TRANSPORT_POLICY`

هذه إعدادات عميل عامة وليست أسراراً. لا تضع `TURN_SECRET` أو Service Account أو مفاتيح خاصة ضمن `NEXT_PUBLIC_*`. شغّل محلياً:

```powershell
npm run typecheck --prefix web
npm run build --prefix web
npm run test:health --prefix web
```

في إعدادات الإنتاج/المعاينة لا تضبط `NEXT_PUBLIC_FIREBASE_EMULATORS` ولا `IMI_USE_FIREBASE_EMULATORS`. اترك `IMI_ACCOUNT_DELETION_ENABLED` غير مضبوط (معطّلاً افتراضياً). لا تنسخ Service Account إلى Git أو أي ملف متعقب.

لا يوجد حالياً Firebase Hosting target في `firebase.json`، ولذلك فإن `firebase deploy --only hosting` ليس أمراً صالحاً لهذا المستودع. لا تنشئ backend أو domain أو DNS قبل اختيار المضيف وموافقة المالك.

## 7. مسار نشر القواعد — اختياري وبموافقة المالك فقط

المسار الأبسط لخطة Spark هو تشغيل Firebase CLI محلياً من حاسوب المالك باستخدام الأمر المحدد في القسم 4. لا يحتاج هذا المسار إلى Workload Identity أو Service Account للنشر من GitHub، ولا ينشر Storage أو Functions.

يبقى `.github/workflows/firebase-deploy.yml` خياراً إضافياً فقط: يتحقق أولاً من قواعد Firestore والفهارس في Emulator، ثم لا يحاول النشر إلا عند تشغيل يدوي مع `confirm_deploy=DEPLOY` وموافقة المالك. مصادقة Google OIDC اختيارية؛ إذا لم يكن السرّان `GCP_WORKLOAD_IDENTITY_PROVIDER` و`FIREBASE_DEPLOY_SERVICE_ACCOUNT` مضبوطين، يتخطى الـWorkflow النشر صراحةً ولا يحدث أي تغيير في Firebase.

لا تشغّل CLI أو Workflow الآن؛ لا نشر إنتاجي ولا تعديل Firebase حقيقي دون موافقة مستقلة.


## أخطاء متوقعة وكيفية التعامل معها

| الرسالة/العَرَض | المعنى المحتمل | الإجراء الآمن |
|---|---|---|
| `Failed to authenticate` أو طلب تسجيل الدخول | CLI غير مسجل أو انتهت الجلسة | أعد `firebase login` محلياً وتحقق من الحساب |
| `HTTP 403` أو `Permission denied` | حساب المالك أو service account يفتقد صلاحية | راجع IAM بأقل صلاحية؛ لا توسع الأدوار عشوائياً |
| `Project not found` أو مشروع نشط غير متوقع | اختيار مشروع خاطئ أو لا توجد صلاحية | أوقف العملية وتحقق من `.firebaserc` و`firebase projects:list` |
| `Secret does not exist` أو مطالبة بإنشاء السر | السر غير موجود أو غير مربوط بالدالة | أنشئه المالك بالأمر التفاعلي أعلاه؛ لا تضع القيمة في Git |
| `firebase-tools no longer supports Java version before 21` | Firebase CLI 15.37.0 يرفض JDK أقدم من 21 | ثبّت JDK 21 أو أحدث واجعل JAVA_HOME وPATH يشيران إليه ثم أعد الاختبار |
| `EADDRINUSE` عند تشغيل Emulator | المنفذ مستخدم | أوقف العملية المالكة للمنفذ أو اضبط منفذاً محلياً مختلفاً |
| `npm ci` يقول إن lockfile غير متزامن | package.json تغير دون تحديث lockfile | أعد إنشاء lockfile باستخدام npm 22، راجعه، ثم أعد الاختبار |
| فشل اختبار `users/{uid}` | اختلاف بين شكل كتابة Android وقواعد Firestore | لا تنشر القواعد؛ أصلح العقد واختبر العمليات نفسها في Emulator |
| لا يظهر مرشح `relay` | لا يوجد TURN host فعلي/الوصول أو المصادقة غير صحيحة | STUN-only متوقع عند غياب TURN_HOST؛ لا تدّعِ نجاح TURN |
| `firebase deploy` غير معروف أو CLI قديم | PATH أو CLI غير صحيح | استخدم `npx --yes firebase-tools@15.37.0` وتحقق من `--version` |

## قاعدة دقيقة لتقارير النشر

- إذا كان Workflow يحتوي `jobs: []` أو لم يبدأ أي Job، اكتب **«لم يبدأ — لا توجد Jobs»**. لا تكتب «فشل النشر».
- لا تكتب **«فشل النشر»** إلا بعد إثبات أن خطوة أمر `firebase deploy` بدأت فعلاً وفشلت.
- في أي تقرير فشل، اذكر دائماً: **اسم الـ Job، اسم الـ Step، سطر الخطأ الحرفي، SHA، ورابط GitHub Actions Run**.
- فشل typecheck أو Emulator أو build قبل أمر النشر يسمى فشل تحقق/اختبار، وليس فشل نشر.
- لا يوجد نشر إنتاجي مثبت بهذا الدليل.


## 8. بناء Android عند توفر عنوان API فعلي

لا تضع عنوان خادم افتراضياً داخل التطبيق أو المستودع. عند اختيار مضيف API والتحقق من عنوانه، مرّر أصل النطاق فقط (scheme + host، دون مسار API) وقت البناء:

```bash
./gradlew assembleDebug -PIMI_API_BASE_URL=https://<النطاق-الفعلي>
```

استبدل `<النطاق-الفعلي>` بعنوان المضيف الذي تم التحقق منه. لا تستخدم قيمة تجريبية أو رابط معاينة منتهي الصلاحية. إبقاء المتغير فارغاً يجعل وظائف الخادم التي تعتمد عليه غير مهيأة، وهو أفضل من توجيه التطبيق إلى خادم غير معروف.
