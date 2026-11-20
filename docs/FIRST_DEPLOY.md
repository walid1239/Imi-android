# IMI — دليل أول إعداد ونشر يدوي (للمالك فقط)

**الحالة: دليل تحضيري فقط. لا يوجد نشر، ولا تسجيل دخول CLI، ولا إنشاء أسرار أو تعديل إعدادات Firebase تم بواسطة هذا المستودع.**

## بوابات إلزامية قبل البدء

- تأكد أن Node.js 22 مثبت محلياً: `node --version`.
- ثبّت JDK 21 أو أحدث لتشغيل Firebase Emulator Suite مع firebase-tools 15.37.0؛ Gradle build Android يبقى على JDK 17 كما هو.
- استخدم مشروع Firebase الصحيح فقط: `imi-indroid`.
- ملفات القفل الثلاثة ملتزمة في المستودع ومولّدة بـ npm 22: `package-lock.json` و`functions/package-lock.json` و`web/package-lock.json`. استخدم `npm ci` ولا تعدّلها يدوياً.
- **لا تنشر Firestore rules الحالية الآن.** يجب أولاً حل تعارض/عدم تطابق عقد `users/{uid}` بين كتابة Android وحقول السماح في `firestore.rules`، ثم إضافة/اجتياز Emulator tests التي تغطي كتابة Android الفعلية. لا يكفي نجاح الاختبارات الحالية وحده.
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

## 3. إنشاء TURN_SECRET بواسطة المالك

إذا قررت استخدام callable الحالي الذي يربط السر، أنشئ السر بنفسك محلياً:

```powershell
npx --yes firebase-tools@15.37.0 functions:secrets:set TURN_SECRET --project imi-indroid
```

أدخل القيمة العشوائية في المطالبة التفاعلية محلياً. لا ترسل السر في المحادثة ولا تضفه إلى Git أو ملف `.env` متعقب. احتفظ به في مدير كلمات مرور آمن.

حتى إن لم يكن لديك خادم TURN، اترك `TURN_HOST` غير مضبوط. في هذه الحالة يعيد `getIceServers` خوادم STUN فقط ويكون `turnAvailable=false`. وجود secret لا يشغّل Coturn ولا يفتح منافذ. لا تضبط `TURN_HOST` حتى يكون لديك خادم TURN يمكن الوصول إليه واختباره.

## 4. اختبار القواعد محلياً — قبل أي نشر

```powershell
npm run emulators:test
```

ثم شغّل اختبارات Functions:

```powershell
npm test --prefix functions
```

إذا ظهر أن منفذ Emulator مستخدم، أوقف العملية المحلية التي تستخدمه أو غيّر المنفذ في إعدادات Emulator واختبر من جديد. إذا ظهر `Permission denied` في اختبار، لا تتجاوز القاعدة ولا تنشرها؛ حدّد المستند والعملية والـ UID التي فشلت.

### بوابة users/{uid} — توقف إلزامي

قبل نشر القواعد:
1. اجرد كل حقول مستند المستخدم الجذر التي ينشئها أو يعدلها Android.
2. قارنها بالـ allowlist في `firestore.rules` وبالكتابة من Web.
3. قرر حقولاً مشتركة آمنة، واجعل الحقول الحساسة server-owned.
4. أضف Emulator tests للعمليات نفسها التي ينفذها Android (إنشاء/تحديث الملف الشخصي، وأي تحديثات أخرى).
5. لا تتابع إلا بعد نجاح الاختبارات ومراجعة diff صريح للقواعد.

**لا تنفذ أمر نشر القواعد في الوضع الحالي.**

بعد إغلاق هذه البوابة وموافقة المالك فقط:

```powershell
npx --yes firebase-tools@15.37.0 deploy --only firestore:rules,firestore:indexes,storage --project imi-indroid
```

## 5. نشر Cloud Functions بعد القواعد

تأكد من بناء Functions واختبارها:

```powershell
npm test --prefix functions
```

ثم، بعد موافقة نشر مستقلة:

```powershell
npx --yes firebase-tools@15.37.0 deploy --only functions --project imi-indroid
```

لا تتابع إذا ظهرت مطالبة Secret غير متوقعة أو اختلاف مشروع. تأكد من أن السر `TURN_SECRET` أُنشئ بواسطة المالك قبل نشر الدالة التي تعلنه ضمن secret bindings.

## 6. إعداد ونشر الويب — بعد اختيار المضيف

الويب يستخدم Next.js 15 App Router. اختر المضيف أولاً:
- Vercel: مناسب لتجربة مجانية شخصية ضمن قيود Hobby وشروطه؛ لا تفترض أنه مجاني بلا حدود لتطبيق اجتماعي عام/تجاري.
- Firebase App Hosting: يدعم Next.js، لكنه يتطلب Blaze وربط Cloud Billing؛ لا تستخدمه ما دام شرط عدم ربط فوترة قائماً.

المتغيرات العامة المطلوبة موجودة في `web/.env.example`:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (اختياري بعد إعداد FCM)
- `NEXT_PUBLIC_STUN_URLS`
- `NEXT_PUBLIC_ICE_TRANSPORT_POLICY`

هذه إعدادات عميل عامة وليست أسراراً. لا تضع `TURN_SECRET` أو Service Account أو مفاتيح خاصة ضمن `NEXT_PUBLIC_*`. شغّل محلياً:

```powershell
npm run typecheck --prefix web
npm run build --prefix web
npm run test:health --prefix web
```

لا يوجد حالياً Firebase Hosting target في `firebase.json`، ولذلك فإن `firebase deploy --only hosting` ليس أمراً صالحاً لهذا المستودع. لا تنشئ backend أو domain أو DNS قبل اختيار المضيف وموافقة المالك.

## 7. تفعيل Workflow النشر بعد وجوده على main

ملف `.github/workflows/firebase-deploy.yml` مصمم ليعمل يدوياً (`workflow_dispatch`) فقط. بعد مراجعة التغييرات ودمجها إلى `main` بموافقة المالك، ومن دون تفعيل تلقائي:
1. افتح GitHub → Actions → **IMI Firebase Cloud Deployment**.
2. اختر **Run workflow** على فرع `main`.
3. أدخل `project_id=imi-indroid`.
4. اكتب `DEPLOY` حرفياً في خانة التأكيد.
5. تأكد من إعداد GitHub Environment باسم `firebase-production`، مع allowlist للمشروع `FIREBASE_PROJECT_ID`، وOIDC provider وservice account بأقل صلاحيات لازمة، ومراجعة/موافقة Environment عند تفعيلها.
6. راجع SHA واسم كل Job وكل Step قبل متابعة أي إجراء.

لا تفعّل Workflow أو تشغّله أثناء وضع الأمان الحالي.

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
