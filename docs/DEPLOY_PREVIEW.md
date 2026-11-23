# دليل إعداد معاينة IMI على Vercel

هذا الدليل يجهّز **Preview فقط** على Firebase Spark. لا ينفّذ نشر Production أو يدمج PR أو ينشر قواعد Firebase أو Cloud Functions. لا تفعّل Blaze ولا تضف بطاقة دفع. افحص شروط خطة Vercel الحالية قبل استخدامها؛ هذا المسار ليس اعتماداً لإطلاق تجاري.

## 1. تفعيل طرق تسجيل الدخول في Firebase

في Firebase Console للمشروع `imi-indroid`:
1. افتح **Authentication → Sign-in method**.
2. فعّل **Anonymous** و**Email/Password** و**Google**.
3. لا تفعّل OTP أو WhatsApp؛ مسار OTP غير منفّذ في هذا الفرع.

## 2. نسخ إعدادات تطبيق الويب

من **Project settings → Your apps** اختر تطبيق الويب وانسخ قيمه إلى متغيرات **Preview** في Vercel:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` — يجب أن تساوي `imi-indroid`.
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
وأضف `FIREBASE_PROJECT_ID=imi-indroid`. إعدادات OIDC الإضافية موضحة في القسم التالي.

هذه إعدادات عميل وليست مفتاح Admin. لا تنسخ أي قيمة إلى GitHub أو سجل عام أو هذه المحادثة.

## 3. اعتماد Firebase Admin للخادم عبر Workload Identity Federation

يعتمد الخادم على Vercel OIDC لتبادل هوية قصيرة العمر مع Google Cloud؛ لا يُستخدم مفتاح JSON ولا يُخزّن أي مفتاح خاص لحساب الخدمة.

### إعداد Vercel OIDC

1. افتح مشروع Vercel `imi-preview` ضمن الفريق `walid2`.
2. افتح **Settings → Security → Secure backend access with OIDC federation**، وفعّل OIDC واختر **Team issuer**.
3. يجب أن يكون issuer هو `https://oidc.vercel.com/walid2`، وأن يكون جمهور الرمز `https://vercel.com/walid2`.
4. لا تضف إعدادات Production أو Development؛ صلاحية Google ستُمنح لبيئة Preview فقط.

### إعداد Google Cloud مرة واحدة

في مشروع Google Cloud رقم `135769436246`:

1. افتح **IAM & Admin → Workload Identity Federation** وأنشئ Pool:
   - Pool name: `IMI Vercel Preview`
   - Pool ID: `imi-vercel-preview`
2. أضف Provider من النوع **OpenID Connect (OIDC)**:
   - Provider name: `Vercel Preview`
   - Provider ID: `vercel-preview`
   - Issuer URL: `https://oidc.vercel.com/walid2`
   - Allowed audience: `https://vercel.com/walid2`
   - Attribute mapping: `google.subject = assertion.sub`
3. افتح تفاصيل Pool وانسخ IAM principal الخاص بالـ subject، ثم استخدم subject التالي حرفياً عند منح الوصول:
   `owner:walid2:project:imi-preview:environment:preview`
4. افتح **IAM & Admin → Service Accounts** واختر حساب Firebase Admin الموجود:
   `firebase-adminsdk-fbsvc@imi-indroid.iam.gserviceaccount.com`
5. في صلاحيات حساب الخدمة، أضف principal أعلاه بدور **Workload Identity User** (`roles/iam.workloadIdentityUser`). لا تمنح صلاحية للمشروع كله ولا تستخدم مفتاح JSON.
6. لا تغيّر أدوار حساب الخدمة الحالية في مشروع Firebase؛ الـ federated principal يكتسب فقط حق انتحال حساب الخدمة، بينما تبقى صلاحيات Firebase على حساب الخدمة نفسه.

### متغيرات Vercel

أُضيفت القيم التالية إلى **Preview فقط** في مشروع `imi-preview`:

- `GCP_PROJECT_NUMBER=135769436246`
- `GCP_WORKLOAD_IDENTITY_POOL_ID=imi-vercel-preview`
- `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID=vercel-preview`
- `FIREBASE_SERVICE_ACCOUNT_EMAIL=firebase-adminsdk-fbsvc@imi-indroid.iam.gserviceaccount.com`

ويظل `FIREBASE_PROJECT_ID=imi-indroid` موجوداً في Preview. لا تضف `FIREBASE_SERVICE_ACCOUNT_JSON`؛ يتحقق فحص البناء من غيابه ويرفضه إذا أُضيف.

بعد إعداد Pool وProvider وربط دور Workload Identity User، أعد نشر Preview. فشل استدعاء Firebase Admin بعد ذلك يعني عادةً أن issuer أو audience أو subject أو صلاحية انتحال حساب الخدمة لا تطابق الإعداد أعلاه.


## 4. ربط GitHub بمشروع Vercel — Preview فقط

1. في Vercel اختر **Add New → Project** ثم استورد `walid1239/Imi-android`.
2. اضبط **Root Directory = web** و**Framework Preset = Next.js**.
3. اضبط Node.js على **22.x**. اترك Install Command وBuild Command على القيم الافتراضية لـ Next.js؛ `web/package.json` يحتوي `prebuild` ثم `next build`.
4. فعّل خيار **Include source files outside of the Root Directory** في إعداد Root Directory؛ لأن `web/src/lib/server/imi-api.ts` يستورد وحدات من `functions/src` خارج مجلد `web`.
5. اجعل جميع المتغيرات أعلاه في **Preview Environment فقط**.
6. في Git settings اضبط Production Branch على اسم فرع غير مستخدم، مثلاً `production-disabled`، حتى لا يتحول `main` إلى نشر Production. سكربت `scripts/vercel-ignore.sh` يتخطى أي build إذا كانت `VERCEL_ENV=production`، ويسمح في Preview بفرعي `feature/imi-teacher-admin-preview` و`main` فقط. اضبط Ignored Build Step إن لزم على `bash scripts/vercel-ignore.sh`؛ وملف `vercel.json` يضبطه أيضاً.
7. لا تنفذ Deploy يدويّاً إلى Production. النشر المتوقع بعد الربط هو Preview تلقائي مع كل push إلى الفرع المسموح.

## 5. السماح بنطاق المعاينة في Firebase Auth

بعد أول Preview ناجح، انسخ hostname فقط من الرابط، ثم افتح **Firebase Console → Authentication → Settings → Authorized domains** وأضفه. لا تضف نطاقاً لا تملكه أو لا تثق به.

## 6. منح صلاحية المشرف من جهاز المالك

السكربت الفعلي هو `functions/scripts/grant-admin.cjs`. يقبل UID أو بريداً إلكترونياً (واحداً فقط)، ويبحث عن المستخدم ثم يطلب تأكيداً باستخدام UID الفعلي. لا يمنح صلاحية لحساب غير موجود، ويتأكد أن المشروع `imi-indroid`، ويحافظ على الـ custom claims الأخرى، ثم يعيد قراءة الحساب للتحقق.

### Windows PowerShell

1. ثبّت Google Cloud CLI. من جذر المستودع ثبّت اعتماديات Functions التي يحتاجها السكربت (لا ينشر ذلك أي Function):
```powershell
npm --prefix .\functions ci
```
2. سجّل دخولك بحساب Google الذي يملك صلاحية إدارة مستخدمي Firebase Authentication في المشروع، ثم نفّذ:
```powershell
gcloud auth application-default login
gcloud config set project imi-indroid
$env:GCLOUD_PROJECT = "imi-indroid"
$env:IMI_ADMIN_EMAIL = "البريد-المسجل-في-IMI"
node .\functions\scripts\grant-admin.cjs
```
3. إذا رفض السكربت لعدم وجود تأكيد، اقرأ UID الذي أعاده Firebase للحساب الصحيح من Firebase Console → Authentication → Users، ثم عيّن:
```powershell
$env:CONFIRM_GRANT_IMI_ADMIN = "GRANT_ADMIN_TO_UID_الحقيقي"
node .\functions\scripts\grant-admin.cjs
```
4. بدلاً من البريد يمكن استعمال `$env:IMI_ADMIN_UID = "UID_الحقيقي"`، مع حذف `IMI_ADMIN_EMAIL` من الجلسة. لا تضبط الاثنين معاً.
5. بعد رسالة النجاح، سجّل خروج المشرف ثم ادخل مجدداً أو جدّد ID token كي تصل الـ custom claim. تحقق من لوحة المشرف. لا تنسخ ADC token أو أي اعتماد إلى المحادثة أو المستودع.

### macOS / Linux

```bash
gcloud auth application-default login
export GCLOUD_PROJECT=imi-indroid
export IMI_ADMIN_UID="<UID>"
export CONFIRM_GRANT_IMI_ADMIN="GRANT_ADMIN_TO_<UID>"
node functions/scripts/grant-admin.cjs
```

## 7. استيراد المنهج ونشر الهيكل

1. افتح لوحة المشرف بعد تحديث ID token.
2. استورد الملف `data/curriculum.json` من نسخة المستودع نفسها.
3. راجع عدد العناصر والتحذيرات في المعاينة.
4. انشر الجذور الثلاثة فقط: `primary` ثم `lower-secondary` ثم `upper-secondary`. النشر هرمي ويشمل الأبناء؛ لا تنشر العقد الفرعية منفردة.
5. تحقق من ظهور الهيكل في `/academy`. ملف المنهج الحالي بنية أولية وليس اعتماداً رسمياً من الوزارة، ولا يحتوي دروساً مكتملة.

## 8. قائمة قبول يدوية بالنقر

- [ ] حالة Vercel الأخيرة Preview وليست Production.
- [ ] `/api/health` يعيد HTTP 200.
- [ ] `/login` يفتح بالعربية دون خطأ إعداد.
- [ ] `/academy` يفتح ويعرض مستويات المنهج.
- [ ] جرّب البريد وكلمة المرور، Google، والدخول كضيف بحسابات اختبار.
- [ ] بعد إضافة النطاق، تحقق من تسجيل الدخول الحقيقي؛ E2E المحلي لا يثبت Authorized Domains على النطاق المستضاف.
- [ ] حساب المشرف يرى لوحة الإدارة؛ الحساب العادي لا يرى عمليات الإدارة.
- [ ] معاينة نشر المنهج ثم نشر الجذور الثلاثة فقط.
- [ ] اختبر محادثة ورسالة وصداقة وحالة بحسابي اختبار.
- [ ] لا تعتبر HTTP 200 للصفحة دليلاً على نجاح عمليات الكتابة في Firestore.
- [ ] لا تفعّل رفع الفيديو أو الملفات قبل حسم أهلية Firebase Storage على Spark واختبار القواعد.

## 9. نشر قواعد Firestore والفهارس — من جهاز المالك وبعد موافقة صريحة

لا تنشر القواعد إلا بعد اخضرار CI على SHA المعني ومراجعة التغييرات وموافقة المالك الصريحة. من جذر المستودع:
```powershell
npx firebase-tools@15.37.0 login
npx firebase-tools@15.37.0 use imi-indroid
npx firebase-tools@15.37.0 deploy --only firestore:rules,firestore:indexes
```
لا تضف `storage` أو `functions` إلى الأمر. لا يتم نشر أي قواعد إلى Firebase الحقيقي بواسطة CI.

## 10. جدول أخطاء وحلولها

| الخطأ الظاهر | السبب المحتمل | الإجراء |
|---|---|---|
| `متغير مفقود: GCP_PROJECT_NUMBER` أو أحد متغيرات WIF | إعدادات Workload Identity غير مكتملة في Preview | أضف متغيرات القسم 3 إلى Preview فقط. |
| `Vercel OIDC identity token is unavailable` | OIDC غير مفعّل أو لا يصل header إلى Function | فعّل Team OIDC في إعدادات المشروع وتحقق من أن النشر Preview. |
| `auth/unauthorized-domain` | نطاق Vercel غير مسموح | أضف hostname الفعلي إلى Authorized domains. |
| `CONFIGURATION_NOT_FOUND` أو `auth/configuration-not-found` | مزود الدخول غير مفعّل أو إعداد مشروع الويب غير صحيح | فعّل المزود المستخدم وراجع Project ID وAuth Domain ومفتاح API. |
| `Google Workload Identity Federation is not configured` | إعداد Pool/Provider أو متغيرات Preview ناقصة | راجع القيم في القسم 3. |
| `403` في لوحة المشرف | المستخدم لا يحمل claim admin أو ID token قديم | أعد التحقق من claim وجدّد ID token/أعد تسجيل الدخول. |
| `404` لمسار Admin health | المسار التشخيصي محمي/غير مفعّل | هذا متوقع افتراضياً؛ لا تفعّل `IMI_ADMIN_HEALTH` في الاستضافة. |
| فشل استيراد وحدات `functions/src` | لم يُفعّل Include source files outside Root Directory | فعّل الخيار في إعدادات Root Directory ثم أعد Preview. |
| تم تخطي النشر | الفرع غير مسموح أو VERCEL_ENV=production | تحقق أن push على الفرع المسموح وأن البيئة Preview. |
| فشل صلاحية المشرف | ADC لا يملك صلاحية Firebase Auth | سجّل ADC بحساب مخوّل وكرر بعد التأكد من المشروع `imi-indroid`. |

## 11. الممنوعات وحدود الاختبار

- لا Production، لا دمج PR، لا Blaze، لا دفع، ولا Cloud Functions.
- لا تنشئ أو ترفع أو تخزن مفتاح JSON لحساب الخدمة. لا تضع أسراراً في GitHub أو سجلات CI أو الدردشة.
- لا تنشر Firestore/Storage rules إلى المشروع الحقيقي إلا وفق بند الموافقة أعلاه.
- CI يستخدم Firebase Emulators منفصلة؛ نجاحه لا يثبت اتصالاً أو مصادقة أو صلاحيات على Firebase الحقيقي.
- لا تعتبر Vercel Preview إطلاقاً تجارياً معتمداً؛ راجع شروط الخطة وحدودها قبل أي استخدام تجاري.
