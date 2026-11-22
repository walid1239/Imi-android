# دليل المعاينة اليدوية لـ IMI

**الحالة: تعليمات للمالك فقط. لم يُنشأ نشر معاينة أو نشر إنتاجي أثناء إعداد هذا الملف.**

## 1. حدود لا يجوز تجاوزها

- استخدم مشروع Firebase المعرّف `imi-indroid` وخطة Spark المجانية فقط.
- لا تربط بطاقة، ولا تفعّل Blaze، ولا تنشئ خدمة مدفوعة.
- لا تنشر Cloud Functions ولا تستدعِها من العميل. المسارات الخلفية المعتمدة في هذه المرحلة هي Next.js تحت `/api/v1`.
- لا تنشر قواعد Firestore أو فهارسه أو قواعد Storage دون موافقة مستقلة وصريحة من المالك.
- لا تغيّر بيانات Firebase الحقيقية، ولا تمنح صلاحية مشرف، ولا تنفّذ استيراداً أو نشراً للمنهاج الحقيقي دون موافقة مستقلة.
- لا تدمج PR #2 أو PR #5. PR #5 ما زال Draft وغير مدمج.
- لا تعتبر المعاينة قبولاً للإنتاج. ملف `docs/RELEASE_GATE.md` ما زال يعلن أن المشروع **غير معتمد للإنتاج**.

## 2. اختيار مضيف المعاينة

الخيار الموثق حالياً هو **Vercel Hobby للمعاينة الشخصية غير التجارية فقط**. شروط Hobby تقصر استخدامه على الاستخدام الشخصي وغير التجاري؛ لذلك لا يُعد خيار استضافة تجارية لـ IMI ولا موافقة على إطلاق خدمة مدفوعة أو تحقيق دخل.

لم يثبت بعد تشغيل `firebase-admin` والتحقق من ID token وكتابة Firestore من بيئة Cloudflare؛ فلا تعتبر Cloudflare خياراً معتمداً. أما Firebase App Hosting فيتطلب Blaze وربط الفوترة، ولذلك لا تستخدمه مع شرط Spark.

إذا كان الاستخدام المقصود تجارياً، فتوقف قبل النشر وابحث عن مضيف مجاني يسمح صراحة بالاستخدام التجاري ويشغّل Node.js وNext.js وFirebase Admin دون ترقية مدفوعة. لا يوجد في هذا الدليل مضيف تجاري بديل تم إثباته.

## 3. إعداد مشروع Vercel للمعاينة

نفّذ هذه الخطوات من حساب المالك:

1. اربط مستودع `walid1239/Imi-android` بمشروع Vercel جديد مخصص للمعاينة.
2. اضبط **Root Directory** على `web`.
3. فعّل خيار تضمين الملفات الواقعة خارج مجلد الجذر في عملية البناء؛ يحتاج التطبيق إلى ملفات مشتركة من `functions/src/shared`.
4. اختر فرع المعاينة `work/imi-web-foundation-audit-fixes`، وهو الفرع الذي يحتوي تغييرات PR #5 الحالية. لا تختَر `feature/imi-web-foundation` إذا كنت تريد معاينة هذه التغييرات؛ فهذا هو الفرع الأساسي ولم تُدمج إليه تغييرات PR #5.
5. اجعل متغيرات البيئة في **Preview** فقط. لا تضع هذه القيم في Production ولا تنشئ نطاق إنتاجي.
6. لا تغيّر أوامر البناء أو مجلد الإخراج الافتراضية؛ يضبط `web/next.config.ts` جذر تتبع الملفات إلى المجلد الأب حتى تُضمّن الملفات المشتركة.

لا تضغط نشر المعاينة إلا بعد إكمال إعداد المتغيرات في القسم التالي. لم يُنفّذ أي ربط أو نشر من هذه الجلسة.

## 4. متغيرات البيئة

استخرج القيم العامة من إعدادات تطبيق الويب داخل Firebase Console للمشروع `imi-indroid`. أضفها في إعدادات **Preview Environment Variables** على المضيف:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_PROJECT_ID=imi-indroid
FIREBASE_SERVICE_ACCOUNT_JSON
```

- يجب أن تشير المتغيرات العامة الستة إلى تطبيق الويب الصحيح في المشروع `imi-indroid`.
- يجب أن تكون `FIREBASE_PROJECT_ID` مساوية تماماً لـ `imi-indroid`.
- يجب أن يكون `FIREBASE_SERVICE_ACCOUNT_JSON` محتوى JSON صالحاً لحساب خدمة تابع للمشروع نفسه، مع الحقول اللازمة لـ Firebase Admin SDK.
- ضع JSON الخاص بحساب الخدمة في إعدادات الخادم على منصة الاستضافة فقط. لا تضعه في `web/.env.local` أو ملفات Git أو المتصفح أو السجلات أو المحادثات.
- لا تستخدم بادئة `NEXT_PUBLIC_` مع أي سر.
- لا تضبط متغيرات المحاكيات في المعاينة: `NEXT_PUBLIC_FIREBASE_EMULATORS` و`IMI_USE_FIREBASE_EMULATORS` و`FIREBASE_AUTH_EMULATOR_HOST` و`FIRESTORE_EMULATOR_HOST` و`FIREBASE_STORAGE_EMULATOR_HOST` و`FIREBASE_DATABASE_EMULATOR_HOST`. اتركها غير موجودة أو معطّلة.
- لا تضبط `IMI_ACCOUNT_DELETION_ENABLED`؛ يجب أن تبقى ميزة حذف الحساب معطّلة.
- لا تضف `TURN_SECRET` أو مفاتيح TURN. لم يتم اعتماد مضيف TURN أو اختبار مكالمة جهازين.

يفحص `web/scripts/check-env.mjs` إعدادات الإنتاج عندما تكون `VERCEL=1` أو `CHECK_PRODUCTION_ENV=true`. لا يطبع محتوى حساب الخدمة. نجاح البناء لا يثبت اتصال Firebase الحي ولا صحة صلاحيات حساب الخدمة على المشروع الحقيقي.

## 5. إعداد Firebase Authentication والنطاق

من Firebase Console، وبعد التأكد من المشروع `imi-indroid`:

1. افتح **Authentication** ثم **Sign-in method**.
2. فعّل مزوّد **Anonymous** للدخول كضيف.
3. فعّل **Email/Password** للدخول بالبريد وكلمة المرور.
4. فعّل **Google**، واختر بريد الدعم/المشروع عند طلبه، ثم احفظ.
5. لا تفعّل Phone أو OTP؛ مسار WhatsApp/OTP غير معتمد في هذه المرحلة.
6. بعد معرفة نطاق المعاينة الفعلي، أضف اسم النطاق فقط (من دون `https://` أو مسار) إلى **Authentication → Settings → Authorized domains**.
7. تحقق من أن إعدادات تطبيق الويب الستة تطابق المشروع والتطبيق اللذين ربطتهما في Vercel.

للتحقق، ارجع إلى **Authentication → Sign-in method** وتأكد أن المزوّدات الثلاثة تظهر بحالة Enabled. ثم جرّب كل طريقة من صفحة `/login` في نطاق المعاينة. يجب أن تظهر في صفحة الدخول أزرار البريد، Google، والدخول كضيف.

تفعيل مزوّد الدخول أو إضافة نطاق إلى Firebase Console تغيير حقيقي في المشروع، ويجب أن ينفذه المالك بنفسه بعد مراجعته. لم تُعدّل هذه الإعدادات أثناء إعداد الدليل.

## 6. فحوص ما قبل المعاينة

على جهاز المالك، من جذر المستودع، تحقق من الإصدارات ثم نفّذ فحوص الويب:

```bash
node --version
npm --version
npm ci --prefix web
npm run typecheck --prefix web
npm run test:rate-limit --prefix web
npm run test:env --prefix web
npm run build --prefix web
npm run test:health --prefix web
```

يجب أن يستخدم المشروع Node.js 22. يتوقع اختبار البيئة سبعة اختبارات ناجحة. لا تتجاوز فشل أي فحص ولا تحذف خطوة من CI لإظهار اللون الأخضر.

لفحص Firebase CLI من دون تثبيت إصدار متغير:

```bash
npx --yes firebase-tools@15.37.0 --version
```

اختبارات Emulator تُشغّل على مشروع تجريبي يبدأ اسمه بـ `demo-`، ولا تثبت أن Firebase الحقيقي يعمل. لا تشغّل الاختبارات المحلية على مشروع الإنتاج.

## 7. منح صلاحية المشرف — إجراء حساس

**هذا الإجراء يغيّر صلاحيات حساب حقيقي في Firebase Authentication. لا تنفّذه إلا لحساب المالك الذي اختاره بنفسه.**

### ما الذي يفعله السكربت؟

الملف الذي نراجعه هو `functions/scripts/grant-admin.cjs`. عند تشغيله:

- يقرأ `IMI_ADMIN_UID` من متغيرات البيئة؛ أي أنه يحدد الحساب بواسطة **UID** وليس البريد الإلكتروني.
- يقرأ معرّف المشروع من `GCLOUD_PROJECT` أو، إذا لم يوجد، من `FIREBASE_PROJECT_ID`. ويرفض الاستمرار ما لم تكن القيمة `imi-indroid`.
- يشترط أن تكون قيمة `CONFIRM_GRANT_IMI_ADMIN` مطابقة تماماً للنص `GRANT_ADMIN_TO_<uid>` مع استبدال `<uid>` بالـ UID نفسه.
- يبحث عن الحساب بواسطة `auth.getUser(uid)`، ثم يضيف المطالبة المخصصة `admin: true` مع الاحتفاظ بأي مطالبات مخصصة أخرى موجودة.
- يعيد قراءة الحساب ويتأكد أن `customClaims.admin` أصبحت `true`.
- لا ينشئ حساباً جديداً ولا يبحث بالبريد ولا يرسل رسالة للمستخدم.

### اعثر على UID

1. سجّل دخولك إلى [Firebase Console](https://console.firebase.google.com/).
2. اختر المشروع `imi-indroid`.
3. افتح **Authentication** ثم **Users**.
4. ابحث عن حساب المالك الذي أنشأته بعد أول تسجيل دخول.
5. انسخ قيمة **User UID** لذلك الحساب. لا تستخدم البريد مكانها.

### جهّز الاعتماد المحلي دون وضع أي مفتاح في المستودع

هناك طريقتان. اختر واحدة فقط:

**الطريقة الأولى — اعتماد حساب Google المحلي (لا تحتاج ملف مفتاح):**

ثبّت Google Cloud CLI على جهازك إن لم يكن مثبتاً، ثم نفّذ:

```bash
gcloud auth application-default login
```

سجّل الدخول بحساب Google الذي يملك صلاحية إدارة مستخدمي Firebase في مشروع `imi-indroid`. مجرد تسجيل الدخول لا يمنح الصلاحية تلقائياً؛ يجب أن يكون للحساب دور IAM مناسب يسمح بإدارة Firebase Authentication.

**الطريقة الثانية — ملف مفتاح حساب خدمة خارج المستودع:**

من Google Cloud Console افتح **IAM & Admin → Service Accounts**، واختر حساب خدمة تابعاً للمشروع `imi-indroid` ولديه صلاحية إدارة Firebase Authentication، ثم **Keys → Add key → Create new key → JSON**. نزّل الملف إلى مجلد خاص خارج مجلد المستودع، ولا تنقله إلى المشروع.

في Windows PowerShell، عيّن المسار الكامل للملف:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\YOUR_USER\PrivateKeys\imi-indroid-admin.json"
```

في macOS أو Linux:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/PrivateKeys/imi-indroid-admin.json"
```

### ثبّت اعتماديات السكربت

من جذر المستودع، نفّذ:

```bash
npm ci --prefix functions
```

هذا يثبت حزم المشروع محلياً فقط؛ لا ينشر Cloud Functions ولا يشغّلها.

### الأمر الكامل

استبدل `PASTE_UID_HERE` بالـ UID الذي نسخته من Firebase Console.

**Windows PowerShell:**

```powershell
$env:GCLOUD_PROJECT = "imi-indroid"
$env:IMI_ADMIN_UID = "PASTE_UID_HERE"
$env:CONFIRM_GRANT_IMI_ADMIN = "GRANT_ADMIN_TO_PASTE_UID_HERE"
node functions/scripts/grant-admin.cjs
```

تأكد أن الجزء بعد `GRANT_ADMIN_TO_` هو UID نفسه حرفياً. إذا اخترت اعتماد Google المحلي، نفّذ `gcloud auth application-default login` قبل الأمر. وإذا اخترت ملف المفتاح، عيّن `GOOGLE_APPLICATION_CREDENTIALS` كما سبق بدلاً من ذلك.

**macOS أو Linux:**

```bash
export GCLOUD_PROJECT="imi-indroid"
export IMI_ADMIN_UID="PASTE_UID_HERE"
export CONFIRM_GRANT_IMI_ADMIN="GRANT_ADMIN_TO_PASTE_UID_HERE"
node functions/scripts/grant-admin.cjs
```

### ماذا ترى عند النجاح أو الفشل؟

عند النجاح يطبع السكربت رسالة مشابهة لهذه، مع UID الحقيقي:

```text
Granted and verified IMI admin claim for UID PASTE_UID_HERE in project imi-indroid. The user must refresh their ID token.
```

عند الفشل يطبع بادئة `Admin claim provisioning failed:` ثم سبب الخطأ. أمثلة الإصلاح:

- `Set IMI_ADMIN_UID and GCLOUD_PROJECT (or FIREBASE_PROJECT_ID).` — عيّن UID ومعرّف المشروع كما في الأمر.
- `Refusing to grant admin outside the approved IMI project...` — تأكد أن `GCLOUD_PROJECT` أو `FIREBASE_PROJECT_ID` هو `imi-indroid` بالضبط.
- `Set CONFIRM_GRANT_IMI_ADMIN to the exact value GRANT_ADMIN_TO_<uid>.` — أعد كتابة قيمة التأكيد لتطابق UID حرفياً.
- `auth/user-not-found` أو رسالة تفيد أن المستخدم غير موجود — راجع UID في Authentication → Users وتأكد أن الحساب سجّل الدخول وأنك لم تنسخ البريد بدلاً منه.
- `Could not load the default credentials` أو خطأ اعتماد — أعد تسجيل الدخول باستخدام `gcloud auth application-default login` أو تحقق من مسار ملف JSON في `GOOGLE_APPLICATION_CREDENTIALS`.
- `Permission denied` أو `insufficient permission` — الحساب المستخدم للاعتماد لا يملك صلاحية إدارة Firebase Authentication في المشروع؛ اطلب من مالك المشروع منحه الدور المناسب، ولا تحاول تجاوز الرفض.

### حدّث الجلسة وتحقق من الواجهة

1. بعد نجاح السكربت، سجّل الخروج من IMI ثم ادخل مجدداً بالحساب نفسه. يمكن أيضاً تجديد Firebase ID token، لكن الخروج والدخول أوضح للمالك.
2. افتح `/app`. يجب أن يظهر تبويب **إدارة الأكاديمية** لحساب المشرف.
3. افتح حساب اختبار عادياً لا يحمل `admin: true`. يجب ألا يظهر له تبويب **إدارة الأكاديمية**، وإذا فتح لوحة الإدارة مباشرة فستظهر رسالة أن الصفحة للمشرفين فقط.
4. إذا لم يظهر التبويب بعد النجاح، سجّل الخروج والدخول مجدداً أولاً، ثم أعد تحميل الصفحة. لا تكرر منح الصلاحية بلا داعٍ.

**تحذير أمني:** لا ترفع مفتاح حساب الخدمة إلى Git، ولا ترسله إلى أي شخص، ولا تلصقه في هذه المحادثة أو أي محادثة أخرى أو سجل. لا تضعه في ملفات المشروع. بعد استعمال ملف JSON محلياً، احذف الملف من جهازك. لا تحذف اعتماد Google المحلي إذا كنت تحتاجه لأعمال أخرى؛ أما ملف المفتاح الذي أنشأته لهذا الإجراء فيجب حذفه.

## 8. التحقق بعد إنشاء المعاينة

استبدل النطاق التالي بنطاق المعاينة الذي أنشأه المالك:

```bash
curl -i https://<preview-domain>/api/health
curl -i https://<preview-domain>/api/v1/health
```

المتوقع هو HTTP 200 عند اكتمال إعدادات البيئة. هذان المساران فحصا حياة وإعداد فقط؛ لا يثبتان نجاح تسجيل الدخول أو الكتابة إلى Firestore أو صلاحية كل عملية في Firebase Admin.

بعد ذلك اختبر يدوياً، بحسابات اختبار يملكها المالك:

- فتح صفحة الدخول وصفحة الأكاديمية دون أخطاء تحميل.
- تسجيل الدخول بالبريد وكلمة المرور ثم تسجيل الخروج.
- تسجيل الدخول المجهول إذا كان المالك قد أبقى هذا المزود مفعّلاً.
- تسجيل الدخول عبر Google بعد إعداد النطاق والمزوّد.
- عدم ظهور لوحة الإدارة لحساب لا يحمل مطالبة `admin: true`.
- فتح لوحة الإدارة بحساب مشرف مخوّل فقط.
- تقديم طلب أستاذ بحساب اختبار: الاسم الكامل، رابط HTTPS، مستوى منشور ومادة منشورة. لا توجد عملية رفع ملف في نموذج الطلب.
- اعتماد أو رفض طلب الأستاذ من لوحة المشرف، والتحقق من ظهور النتيجة.
- تجربة إنشاء حالة وفتح محادثة بحسابات اختبار فقط، والتحقق من ظهور النتيجة بعد تحديث الصفحة.
- تصفح الأكاديمية والتحقق من أن العقد المنشورة فقط تظهر للمتعلم.

**حدود التنفيذ الحالي:** بعض إجراءات إدارة الدورات والدروس ومراجعة محتوى الأساتذة القديمة في لوحة الإدارة متوقفة عمداً؛ عند الضغط عليها تعرض رسالة أن العملية لم تُرسل إلى Cloud Functions. لا تعتبر إنشاء دورة أو درس أو مراجعة محتوى أستاذ وظيفة مقبولة حتى تُنقل إلى مسار API وتُختبر. كما أن نجاح فتح الواجهة لا يثبت أن كل كتابة Firestore أو رفع Storage أو مكالمة تعمل.

لا تستخدم بيانات أشخاص حقيقيين أو مستندات حساسة في المعاينة.

## 9. المنهاج: استيراد ومعاينة بنية فقط

- ملف المصدر هو `data/curriculum.json`. يصف الملف الحالي هيكلاً أولياً بلا دروس، ويصرّح بأن العقد التفصيلية `needsReview=true` وليست مصفوفة وزارية مصادقاً عليها. لا تعرضه على أنه منهاج رسمي نهائي.
- من لوحة **إدارة الأكاديمية → إدارة شجرة المنهاج** اضغط **استيراد JSON** واختر `data/curriculum.json`.
- الاستيراد يكتب إلى مجموعة Firestore المسماة `curriculumNodes`. يقبل عناصر جديدة فقط ويرفض المعرّفات الموجودة؛ ويخزن العناصر المستوردة مخفية مع `needsReview: true`. هذا تغيير فعلي في بيانات Firebase، حتى لو كانت العناصر مخفية. لا تنفذه إلا بموافقة المالك.
- لكل عقدة من نوع مستوى، اضغط **معاينة النشر** أولاً. هذا يرسل `dryRun: true` ويعرض العدد والأنواع دون تعديل البيانات.
- بعد مراجعة نتيجة كل مستوى ومصدره وترتيبه وعلاقاته، وبموافقة المالك، اضغط **نشر الهيكل**. هذا ينفذ كتابة فعلية تنشر العقد التابعة لذلك المستوى.
- لا تضغط **اعتماد ونشر** على عقدة مفردة؛ مراجعة عناصر المنهاج المفردة متوقفة مؤقتاً في الواجهة.
- يجب مراجعة صحة البيانات قبل إظهارها للمتعلمين. لا تنشر دروساً أو مقررات أو محتوى تجريبياً لإخفاء نقص البيانات.
- لا تشغّل `scripts/seed-curriculum.cjs --production`. وضع الإنتاج يتطلب صراحة `--project=imi-indroid --confirm=imi-indroid` وينفذ كتابة فعلية إلى Firestore؛ وهو خارج نطاق معاينة آمنة دون موافقة مستقلة.

## 10. قواعد Firestore والفهارس

لا تنشر القواعد أو الفهارس من إعدادات Vercel. بعد اخضرار CI ومراجعة نتائج Emulator وموافقة المالك الصريحة فقط، يستطيع المالك تشغيل الأوامر التالية من جذر المستودع:

```bash
npx --yes firebase-tools@15.37.0 login
npx --yes firebase-tools@15.37.0 use imi-indroid
npx --yes firebase-tools@15.37.0 deploy --only firestore:rules,firestore:indexes
```

هذا الأمر ينشر Firestore Rules وIndexes فقط وفق المسارات المحددة في `firebase.json`. لا تضف `storage` أو `functions` أو `hosting` إلى الأمر. لا تنفذه ضمن إعداد المعاينة الحالية أو دون موافقة منفصلة. لا يوجد في هذا الدليل أي خطوة لنشر Cloud Functions.

## 11. بناء Android للمعاينة

المشروع يستخدم ملف `app/build.gradle.kts` في جذر المستودع، ويحتاج JDK 17 وAndroid SDK 35 وGradle 8.9. لا يوجد ملف Gradle Wrapper (`gradlew`) متحقق منه في جذر هذا الفرع؛ لذلك استخدم Gradle 8.9 المثبت محلياً بدلاً من أمر `./gradlew`.

ضع `google-services.json` محلياً في `app/google-services.json` إذا أردت تفعيل معالجة إعداد Firebase Android. الملف مستثنى من Git. لا ترسله إلى المحادثة ولا ترفعه إلى المستودع.

من جذر المستودع نفّذ:

```bash
gradle --no-daemon assembleDebug -PIMI_API_BASE_URL=https://<preview-domain>
```

الناتج المتوقع في بناء Gradle هو `app/build/outputs/apk/debug/app-debug.apk`. هذا Debug APK للاختبار فقط، وليس إصداراً موقعاً أو قبولاً للنشر. في CI تم بناء Debug APK ورفعه كعنصر Artifact باسم `IMI-debug-apk-firebase-configured`؛ لم يُختبر تشغيله على جهاز فعلي ضمن هذه المهمة.

## 12. تشخيص الأعطال

| الرسالة أو الحالة | ما يجب فحصه |
|---|---|
| `CONFIGURATION_NOT_FOUND` أو `auth/configuration-not-found` | راجع القيم العامة الستة، وتطابق `NEXT_PUBLIC_FIREBASE_PROJECT_ID` مع `imi-indroid`، وتأكد من تفعيل مزوّد الدخول الذي تستخدمه في Authentication → Sign-in method. |
| `auth/unauthorized-domain` | أضف نطاق المعاينة الفعلي، دون بروتوكول أو مسار، إلى Authentication → Settings → Authorized domains. |
| فشل بناء Next.js أو فقد ملف من `functions/src/shared` | تأكد أن Root Directory هو `web`، وأن خيار تضمين الملفات خارج مجلد الجذر مفعّل، وأن `web/next.config.ts` يضبط `outputFileTracingRoot` إلى المجلد الأب. |
| HTTP 401 | تحقق من جلسة المستخدم وصلاحية Firebase ID token، ثم سجّل الخروج والدخول مجدداً. |
| HTTP 403 | تحقق من صلاحية العملية ومطالبة المشرف؛ لا تمنح `admin: true` لمجرد تجاوز الرفض. |
| HTTP 429 | تم تجاوز حد الطلبات؛ انتظر انتهاء النافذة ولا تكرر الطلبات آلياً. |
| صفحة فارغة أو رفض تحميل بسبب CSP | افتح أدوات المطور في المتصفح ثم Console وNetwork، وسجّل رسالة Content-Security-Policy وعنوان المورد الذي حُظر. لا تعطّل سياسة الحماية عشوائياً؛ أرسل نص الخطأ بعد إخفاء أي بيانات حساسة. |
| فشل تهيئة Firebase Admin | تحقق من أن JSON صالح وأن `project_id` و`FIREBASE_PROJECT_ID` كلاهما `imi-indroid`. لا تطبع محتوى JSON في السجلات. |
| فشل قراءة المنهاج | تحقق من أن العقد منشورة و`needsReview=false` وأن قواعد Firestore تسمح بالقراءة المطلوبة. لا تنشر قواعد جديدة دون الموافقة المحددة في القسم 10. |

## 13. ما لم يتم تنفيذه

- لم يُنشأ مشروع Vercel أو نطاق معاينة ولم يُنفّذ نشر معاينة.
- لم يُنفّذ نشر إنتاجي أو تعديل لإعدادات Firebase الحقيقية أو قواعده أو فهارسه.
- لم تُمنح صلاحية مشرف ولم تُستورد بيانات المنهاج إلى Firebase الحقيقي.
- لم تُنشر Cloud Functions ولم تُنشر قواعد Storage أو تُشغّل خدمة TURN.
- لم يُربط مشروع بخطة Blaze أو بطاقة أو خدمة مدفوعة.
- لم يُدمج PR #2 أو PR #5.
- لا تعني نتيجة CI الخضراء أن التطبيق جاهز للإنتاج؛ راجع جميع البنود المتبقية في `docs/RELEASE_GATE.md`.
