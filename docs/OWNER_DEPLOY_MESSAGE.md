# رسالة إعداد المعاينة — المالك (خطوة لمرة واحدة)

**الحالة الحالية:** نُشرت معاينة IMI بنجاح بالفعل على Vercel Preview للفرع `feature/imi-teacher-admin-preview`، والرابط هو `https://imi-preview-dwanvq27v-walid2.vercel.app`. هذا ليس نشر Production. هذا الدليل يوضح إعداد WIF المتبقي، واختبار المعاينة، وربط GitHub اختيارياً للنشر التلقائي.

لا تنشئ مفتاح JSON لحساب الخدمة، ولا ترسل أي token أو ملف اعتماد إلى الدردشة أو GitHub أو Issues. لا تفعّل Blaze أو خطة مدفوعة، ولا تنشر Cloud Functions أو Production.

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

## 3. إكمال Workload Identity Federation — مرة واحدة

الكود في `web/src/lib/server/imi-api.ts` يستخدم Vercel OIDC لتبادل هوية قصيرة العمر مع Google Cloud. لا يحتاج إلى `FIREBASE_SERVICE_ACCOUNT_JSON` ولا إلى مفتاح JSON. تم بالفعل تفعيل إصدار OIDC في مشروع Vercel بنمط Team، وإضافة متغيرات WIF الأربعة إلى Preview فقط.

### إعداد Google Cloud المطلوب

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
3. من تفاصيل Pool انسخ IAM principal، ثم قيّد السماح بالـ subject التالي فقط:
   `owner:walid2:project:imi-preview:environment:preview`
4. افتح **IAM & Admin → Service Accounts** واختر حساب الخدمة الموجود:
   `firebase-adminsdk-fbsvc@imi-indroid.iam.gserviceaccount.com`
5. أضف الـ principal أعلاه إلى صلاحيات حساب الخدمة بدور **Workload Identity User** (`roles/iam.workloadIdentityUser`). لا تمنح هذا الدور على المشروع كله.
6. لا تغيّر أدوار Firebase الحالية لحساب الخدمة؛ هذا الربط يسمح لهوية Vercel Preview بانتحال حساب الخدمة فقط.

### متغيرات Vercel الموجودة بالفعل

في **Team walid2 → Project imi-preview → Settings → Environment Variables**، يجب أن تكون القيم التالية على **Preview فقط**:

- `GCP_PROJECT_NUMBER=135769436246`
- `GCP_WORKLOAD_IDENTITY_POOL_ID=imi-vercel-preview`
- `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID=vercel-preview`
- `FIREBASE_SERVICE_ACCOUNT_EMAIL=firebase-adminsdk-fbsvc@imi-indroid.iam.gserviceaccount.com`
- `FIREBASE_PROJECT_ID=imi-indroid`

أُضيفت هذه المتغيرات بالفعل عبر إعدادات Vercel. لا تضف `FIREBASE_SERVICE_ACCOUNT_JSON` ولا تنشئ مفتاحاً خاصاً.

**مهم:** يمكن بناء ونشر صفحة Preview قبل اكتمال ربط Google Cloud، لكن عمليات الخادم التي تستخدم Firebase Admin لن تُعدّ مختبرة حتى ينشئ المالك Pool/Provider ويضيف دور Workload Identity User ثم يختبر طلباً حقيقياً. لا نعتبر المصادقة مكتملة قبل نجاح هذا الاختبار.

## 4. إعداد GitHub وVercel للنشر التلقائي — اختياري

المعاينة الحالية منشورة بالفعل من مستودع GitHub على الفرع `feature/imi-teacher-admin-preview`، ونجح بناء Vercel. لكن بيانات مشروع Vercel التي قرأناها لا تعرض مستودع Git مرتبطاً (`repo=null))؛ لذلك لا أفترض أن كل push سينشئ معاينة تلقائياً.

إذا أردت النشر التلقائي لكل push:

1. افتح **Vercel → Team walid2 → Project imi-preview → Settings → Git**.
2. اربط المستودع `walid1239/Imi-android` إذا لم يكن مرتبطاً.
3. اضبط **Root Directory = web** و**Framework = Next.js** و**Node.js = 22.x**.
4. فعّل **Include source files outside of the Root Directory** لأن التطبيق يستورد وحدات مشتركة من `functions/src`.
5. اترك Install Command وBuild Command افتراضيين، ولا تضبط Production Branch على `main`.
6. تأكد من أن النشر المطلوب للفرع `feature/imi-teacher-admin-preview` هو **Preview** فقط. سكربت `scripts/vercel-ignore.sh` يرفض Production ويسمح بفرعي المعاينة المتفق عليهما.
7. لا تضغط Deploy إلى Production ولا تدمج PR.

إذا لم ترد النشر التلقائي الآن، لا تغيّر إعداد Git؛ المعاينة الحالية READY ويمكن فتحها بعد تسجيل الدخول إلى Vercel، لأن حماية SSO مفعّلة على Preview.

## 5. إضافة نطاق Preview إلى Firebase Authorized domains

بعد ظهور أول رابط Preview ناجح:

1. انسخ اسم النطاق فقط من رابط Vercel، دون `https://` أو مسار.
2. افتح Firebase Console → **Authentication → Settings → Authorized domains**.
3. أضف hostname الفعلي للمعاينة.
4. لا تضف نطاقاً غير تابع لمشروعك أو لا تثق به.

رابط Preview الحالي هو `imi-preview-dwanvq27v-walid2.vercel.app`. أضف هذا hostname إلى Firebase Authorized domains بعد التأكد منه في حساب المالك.

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

- [ ] رابط Vercel يشير إلى Preview وليس Production: `https://imi-preview-dwanvq27v-walid2.vercel.app`.
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
| `متغير مفقود: GCP_PROJECT_NUMBER` أو أحد متغيرات WIF | إعداد WIF ناقص | راجع متغيرات Preview في القسم 3. |
| `Vercel OIDC identity token is unavailable` | OIDC غير مفعّل أو لم يصل header | تحقق من تفعيل Team OIDC وأن الطلب من Preview. |
| `auth/unauthorized-domain` | نطاق Vercel غير مسموح | أضف hostname الفعلي إلى Authorized domains. |
| `CONFIGURATION_NOT_FOUND` أو `auth/configuration-not-found` | موفر الدخول غير مفعّل أو إعداد تطبيق الويب خاطئ | فعّل الموفر وتحقق من Project ID وAuth Domain ومفتاح API. |
| `Google Workload Identity Federation is not configured` | Pool/Provider أو متغيرات Preview ناقصة | راجع إعداد Google Cloud وربط Workload Identity User في القسم 3. |
| `403` في لوحة المشرف | claim غير موجود أو ID token قديم | تحقق من حساب المشرف وجدّد ID token/سجّل الدخول مجدداً. |
| `404` لمسار Admin health | الفحص التشخيصي محمي أو غير مفعّل | متوقع افتراضياً؛ لا تفعّل `IMI_ADMIN_HEALTH` في الاستضافة. |
| فشل استيراد `functions/src` | ملفات المصدر خارج Root Directory غير مضمنة | فعّل Include source files outside of the Root Directory. |
| تم تخطي البناء | فرع غير مسموح أو بيئة Production | استخدم Preview على الفرع المسموح فقط. |
| فشل منح صلاحية المشرف | ADC غير مخوّل أو لم تثبت الحزم | نفّذ `npm --prefix .\functions ci` وسجّل ADC بالحساب المخوّل للمشروع الصحيح. |

## حدود ثابتة

Firebase Spark فقط. لا Blaze ولا دفع ولا Cloud Functions ولا Production ولا دمج PR. لا تضع أي سر في المستودع أو سجلات CI أو الدردشة. اختبارات CI تستخدم Emulators ومحاكاة؛ لا تثبت إعداد Firebase الحقيقي أو تسجيل دخول مستخدم حقيقي. لا تعتبر Preview اعتماداً للإنتاج.
