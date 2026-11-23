# رسالة إعداد المعاينة — المالك (خطوة لمرة واحدة)

**الهدف:** ربط مستودع IMI بمشروع Vercel الحالي حتى ينشئ كل `push` إلى الفرع `feature/imi-teacher-admin-preview` معاينة Preview تلقائياً. هذا ليس نشر Production.

لا ترسل أي مفتاح أو token أو ملف اعتماد إلى الدردشة أو GitHub أو Issues. أدخل المفتاح مباشرة في Vercel فقط. لا تفعّل Blaze أو خطة مدفوعة، ولا تنشر Cloud Functions أو Production.

## 1. إعداد Firebase Authentication

في Firebase Console للمشروع `imi-indroid`:

1. افتح **Authentication → Sign-in method**.
2. فعّل **Anonymous** و**Email/Password** و**Google**.
3. لا تفعّل OTP أو WhatsApp؛ هذا الفرع لا يستخدم OTP.
4. لا تنشئ مستخدماً وهمياً لمجرد اجتياز الاختبار؛ استخدم حساب اختبار تملكه.

## 2. تأكيد إعدادات تطبيق الويب

من **Project settings → Your apps** اختر تطبيق الويب الصحيح. يجب أن تتطابق إعداداته مع المشروع `imi-indroid`.

في Vercel افتح المشروع الحالي **imi-preview** ضمن فريق **walid2**، ثم **Settings → Environment Variables**. توجد بالفعل ستة متغيرات Firebase العامة و`FIREBASE_PROJECT_ID` في Preview. لا تطبع قيمها أو ترسلها لأحد. تحقق فقط من الأسماء وأن الهدف Preview:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_PROJECT_ID` ويجب أن تكون قيمته `imi-indroid`.

إذا كان أي متغير ناقصاً، انسخ القيمة من تطبيق Web في Firebase إلى Vercel مباشرة، وعيّن الهدف **Preview فقط**.

## 3. إضافة اعتماد Firebase Admin للخادم — Vercel Preview فقط

الكود الفعلي في `web/src/lib/server/imi-api.ts` يستعمل `FIREBASE_SERVICE_ACCOUNT_JSON` مع `firebase-admin` و`cert(...)`. متغيرات `google-services.json` أو بريد حساب الخدمة وحده لا يكفيان. Workload Identity Federation غير مطبق في كود الخادم الحالي؛ تفعيل OIDC في Vercel وحده لا يستبدل مفتاح Firebase Admin.

1. افتح Firebase Console → **Project settings → Service accounts** للمشروع `imi-indroid`.
2. أنشئ مفتاح JSON خاصاً لحساب الخدمة المعتمد لهذا المشروع، ونزّله إلى مجلد محلي آمن على جهازك.
3. لا ترفع الملف إلى GitHub ولا تضعه في مجلد المشروع ولا ترسله بالبريد أو الدردشة.
4. محلياً حوّل JSON إلى سطر واحد (minified) دون مشاركته. لا تلصق المفتاح في أي مكان غير حقل Vercel.
5. في Vercel → **imi-preview → Settings → Environment Variables** أضف:
   - الاسم: `FIREBASE_SERVICE_ACCOUNT_JSON`
   - القيمة: JSON الكامل في سطر واحد
   - البيئة: **Preview فقط**
   - النوع/الحماية: **Sensitive** إن ظهر الخيار.
6. احفظ المتغير. تحقق من وجود الاسم والهدف Preview فقط، دون فتح القيمة أو طباعتها.
7. بعد التأكد من الحفظ، احذف ملف JSON المحلي من جهازك. لا تضف هذا المتغير إلى Production أو Development.

**مهم:** لا تشارك المفتاح معي ولا مع أي شخص. لا تضعه في GitHub Secrets أو CI logs. إعداد هذا المتغير هو إجراء يدوي داخل حساب المالك.

## 4. ربط GitHub بمشروع Vercel الحالي

مشروع Vercel `imi-preview` موجود بالفعل. سجل بناء Vercel السابق يثبت أنه استنسخ `github.com/walid1239/Imi-android` من الفرع `feature/imi-teacher-admin-preview`؛ لذلك لا تُعد خطوة ربط GitHub مطلوبة من جديد ما دام هذا الاتصال ظاهراً في Settings → Git. إعدادات Root Directory = `web` وخيار Include source files outside of Root Directory لم يمكن تأكيدهما من قراءة API، لذا تحقق منهما يدوياً. Node.js الظاهر في إعداد المشروع هو `22.x`، وأمر تجاهل البناء المسجل في الإعدادات هو `bash scripts/vercel-ignore.sh`.

نفّذ الربط داخل حساب Vercel:

1. افتح **Vercel → Team walid2 → Project imi-preview → Settings → Git** وتحقق أن المستودع المرتبط هو `walid1239/Imi-android` وأن فرع المعاينة هو `feature/imi-teacher-admin-preview`. سجل البناء السابق يثبت أن Git clone يعمل؛ لا تفصل الاتصال ولا تنشئ مشروعاً جديداً.
2. تأكد من أن **Root Directory = `web`**.
3. تأكد من **Framework Preset = Next.js** و**Node.js Version = 22.x**.
4. اترك **Install Command** و**Build Command** افتراضيين؛ سيشغّل Vercel تثبيت الحزم و`prebuild` ثم `next build`.
5. تأكد من تفعيل **Include source files outside of the Root Directory**؛ التطبيق يستورد وحدات مشتركة من `functions/src` خارج `web`.
6. اجعل Production Branch اسماً غير مستخدم مثل `production-disabled`. السبب: نريد أن يُعامل `main` كـ Preview لا Production. لا تختَر `main` كفرع Production.
7. لا تضغط Deploy إلى Production ولا تغيّر إعدادات النشر إلى Production.

بعد الربط، يطلق Vercel تلقائياً Preview عند كل push إلى `feature/imi-teacher-admin-preview` أو `main`. سكربت `web/scripts/vercel-ignore.sh` يسمح بهذين الفرعين في Preview فقط، ويتخطى الفروع الأخرى وكل بيئة Production.

## 5. إضافة نطاق Preview إلى Firebase Authorized domains

بعد ظهور أول رابط Preview ناجح:

1. انسخ اسم النطاق فقط من رابط Vercel، دون `https://` أو مسار.
2. افتح Firebase Console → **Authentication → Settings → Authorized domains**.
3. أضف hostname الفعلي للمعاينة.
4. لا تضف نطاقاً غير تابع لمشروعك أو لا تثق به.

لا يمكن إكمال هذه الخطوة قبل أن يظهر نطاق Preview حقيقي.

## 6. منح صلاحية المشرف من حاسوب المالك (اختياري، عند الحاجة)

السكربت الفعلي هو `functions/scripts/grant-admin.cjs`. يقبل UID أو بريداً إلكترونياً، واحداً فقط. يتحقق أن المشروع `imi-indroid`، يبحث عن المستخدم في Firebase Authentication، يتطلب تأكيد UID الفعلي، ويحافظ على الـ custom claims الموجودة ثم يعيد قراءة المستخدم للتحقق.

### Windows PowerShell

من جذر نسخة المستودع المحلية:

```powershell
npm --prefix .\functions ci
gcloud auth application-default login
gcloud config set project imi-indroid
$env:GCLOUD_PROJECT = "imi-indroid"
$env:IMI_ADMIN_EMAIL = "البريد-المسجل-في-IMI"
node .\functions\scripts\grant-admin.cjs
```

التشغيل الأول بالبريد دون تأكيد سيوقف العملية ويعرض UID الفعلي المطلوب للتأكيد. تحقق من أن UID يعود إلى الحساب الصحيح، ثم:

```powershell
$env:CONFIRM_GRANT_IMI_ADMIN = "GRANT_ADMIN_TO_UID_الحقيقي"
node .\functions\scripts\grant-admin.cjs
```

بدلاً من البريد، يمكن استخدام UID مباشرة (ولا تضبط البريد معه):

```powershell
Remove-Item Env:IMI_ADMIN_EMAIL -ErrorAction SilentlyContinue
$env:IMI_ADMIN_UID = "UID_الحقيقي"
$env:CONFIRM_GRANT_IMI_ADMIN = "GRANT_ADMIN_TO_UID_الحقيقي"
node .\functions\scripts\grant-admin.cjs
```

يجب أن يكون المستخدم موجوداً بالفعل في Firebase Authentication، وأن يملك حساب Google الذي نفّذ `gcloud auth application-default login` صلاحية إدارة مستخدمي Firebase Authentication في المشروع. لا تشارك ملفات ADC أو access tokens أو أي اعتماد. بعد نجاح السكربت، سجّل خروج حساب المشرف من IMI ثم ادخل مجدداً كي يتجدد ID token ويحمل claim `admin: true`.

## 7. استيراد المنهج ونشر الهيكل من لوحة المشرف

1. سجّل الدخول بحساب المشرف بعد تجديد ID token.
2. افتح قسم المنهج/إدارة المنهج في لوحة المشرف.
3. استورد الملف `data/curriculum.json` من نسخة المستودع نفسها.
4. راجع المعاينة، وعدد العناصر، وأي تحذيرات قبل النشر.
5. انشر الجذور الثلاثة فقط، بالمعرّفات: `primary` ثم `lower-secondary` ثم `upper-secondary`.
6. النشر هرمي ويشمل الأبناء؛ لا تنشر العقد الفرعية منفردة.
7. افتح `/academy` وتأكد من ظهور مستويات المنهج. هذه البيانات بنية أولية وليست اعتماداً رسمياً من الوزارة، ولا تحتوي دروساً مكتملة.

## 8. قائمة قبول المعاينة بالنقر

بعد أول نشر Preview:

- [ ] رابط Vercel يشير إلى Preview وليس Production.
- [ ] `/api/health` يعيد HTTP 200.
- [ ] `/login` يفتح ويعرض الواجهة العربية.
- [ ] `/academy` يفتح ويعرض مستويات المنهج بعد استيراده ونشره.
- [ ] جرّب Email/Password بحساب اختبار.
- [ ] جرّب Google بعد إضافة نطاق المعاينة إلى Authorized domains.
- [ ] جرّب الدخول كضيف بعد تفعيل Anonymous.
- [ ] حساب المشرف يرى لوحة الإدارة، والحساب العادي لا يحصل على صلاحيات الإدارة.
- [ ] جرّب محادثة ورسالة وصداقة وحالة باستخدام حسابات اختبار.
- [ ] لا تعتبر HTTP 200 للصفحات دليلاً على نجاح عمليات Firestore أو Storage.
- [ ] لا تفعّل رفع الملفات أو الفيديو قبل التحقق من أهلية Storage على Spark وقواعده.

## 9. نشر قواعد Firestore والفهارس — من حاسوب المالك وبعد موافقة صريحة فقط

لا تنشر القواعد إلا بعد اخضرار CI على SHA النهائي ومراجعة التغييرات وموافقة المالك الصريحة. من جذر المستودع:

```powershell
npx firebase-tools@15.37.0 login
npx firebase-tools@15.37.0 use imi-indroid
npx firebase-tools@15.37.0 deploy --only firestore:rules,firestore:indexes
```

هذا الأمر لا يتضمن Cloud Functions أو Storage. لا ينشر CI قواعد Firebase الحقيقية.

## 10. جدول الأخطاء والحلول

| الرسالة | السبب المحتمل | الإجراء |
|---|---|---|
| `متغير مفقود: FIREBASE_SERVICE_ACCOUNT_JSON` | سر Admin غير موجود في Preview | أضفه كـ Sensitive في Preview فقط، دون طباعته. |
| `FIREBASE_SERVICE_ACCOUNT_JSON ليس JSON صالحاً` | JSON غير صالح أو منسق على عدة أسطر | أعد نسخه محلياً كسطر واحد وتحقق من سلامته دون عرضه. |
| `auth/unauthorized-domain` | نطاق Vercel غير مسموح | أضف hostname الفعلي إلى Authorized domains. |
| `CONFIGURATION_NOT_FOUND` أو `auth/configuration-not-found` | موفر الدخول غير مفعّل أو إعداد تطبيق الويب خاطئ | فعّل الموفر وتحقق من Project ID وAuth Domain ومفتاح API. |
| `Server credentials are not configured` | اعتماد Admin غير متاح في Runtime | تحقق من اسم المتغير وبيئة Preview ثم أعد النشر. |
| `403` في لوحة المشرف | claim غير موجود أو ID token قديم | تحقق من حساب المشرف وجدّد ID token/سجّل الدخول مجدداً. |
| `404` لمسار Admin health | الفحص التشخيصي محمي أو غير مفعّل | متوقع افتراضياً؛ لا تفعّل `IMI_ADMIN_HEALTH` في الاستضافة. |
| فشل استيراد `functions/src` | ملفات المصدر خارج Root Directory غير مضمنة | فعّل Include source files outside of the Root Directory. |
| تم تخطي البناء | فرع غير مسموح أو بيئة Production | استخدم Preview على الفرع المسموح فقط. |
| فشل منح صلاحية المشرف | ADC غير مخوّل أو لم تثبت الحزم | نفّذ `npm --prefix .\functions ci` وسجّل ADC بالحساب المخوّل للمشروع الصحيح. |

## حدود ثابتة

Firebase Spark فقط. لا Blaze ولا دفع ولا Cloud Functions ولا Production ولا دمج PR. لا تضع أي سر في المستودع أو سجلات CI أو الدردشة. اختبارات CI تستخدم Emulators ومحاكاة؛ لا تثبت إعداد Firebase الحقيقي أو تسجيل دخول مستخدم حقيقي. لا تعتبر Preview اعتماداً للإنتاج.
