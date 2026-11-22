# دليل إعداد معاينة IMI على Vercel

هذا الدليل للمالك فقط. يجهّز **معاينة Preview شخصية** ولا ينفّذ أي نشر أو تغيير في Firebase تلقائياً. لا تستخدم Vercel Hobby لإطلاق تجاري؛ راجع شروط الخطة قبل الاستخدام.

## 1. إعداد موفّرات تسجيل الدخول في Firebase

من Firebase Console للمشروع `imi-indroid`:
1. افتح **Authentication → Sign-in method**.
2. فعّل **Anonymous** و**Email/Password** و**Google**.
3. لا تفعّل OTP أو تسجيل WhatsApp؛ هذا المسار غير منفّذ.

## 2. إعداد تطبيق الويب العام

من **Project settings → Your apps** اختر تطبيق الويب وانسخ القيم إلى متغيرات البيئة العامة التالية في الاستضافة:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

يجب أن تكون `NEXT_PUBLIC_FIREBASE_PROJECT_ID=imi-indroid`. هذه إعدادات عميل وليست مفتاح خدمة Admin، لكن لا تنشرها في محادثات أو سجلات عامة.

## 3. إعداد اعتماد الخادم

من **Project settings → Service accounts → Generate new private key** أنشئ مفتاح خدمة للمشروع الصحيح. احفظ JSON محلياً بأمان، ثم ضع محتواه كاملاً في سطر واحد (minified) في متغير الاستضافة `FIREBASE_SERVICE_ACCOUNT_JSON` ضمن بيئة **Preview** فقط. أضف أيضاً `FIREBASE_PROJECT_ID=imi-indroid`.

- لا تضع ملف JSON في المستودع أو ملفات المشروع.
- لا ترفعه إلى GitHub أو GitHub Actions Secrets؛ لا حاجة لذلك في هذا المسار.
- لا تلصقه في الدردشة أو Issues أو السجلات.
- احذف النسخة المحلية بعد التأكد من حفظ السر في إعدادات الاستضافة، أو خزّنه في مدير أسرار محلي آمن.
- لا تشارك المفتاح مع أي شخص. امتيازات Admin SDK واسعة؛ دوّر المفتاح فور الاشتباه بتسريبه.

## 4. إنشاء معاينة Vercel

استخدم خطة **Hobby للمعاينة الشخصية غير التجارية فقط**:
1. Add New Project واختر مستودع `walid1239/Imi-android`.
2. Root Directory: `web`.
3. Framework Preset: **Next.js**.
4. اختر الفرع `feature/imi-web-foundation` بعد أن يراجع المالك تغييرات الكود ويوافق عليها.
5. تحقق من إعداد **Include source files outside of the Root Directory** (أو ما يعادله في واجهة Vercel) حتى يستطيع البناء تتبّع ملفات `functions/src` المستوردة من خارج `web`.
6. أضف المتغيرات المذكورة في الخطوتين 2 و3 إلى **Preview Environment** فقط. لا تضفها إلى Production.
7. لا تفعّل أي متغير من القائمة المحظورة في الخطوة 10.

فحص `prebuild` يوقف البناء إذا غابت متغيرات Firebase المطلوبة أو وُجدت أعلام Emulator/التجارب المحظورة. لا يطبع أي قيمة سرية.

## 5. السماح بنطاق المعاينة في Firebase Auth

بعد إنشاء أول رابط Preview، انسخ النطاق فقط (من دون مسار)، ثم افتح **Firebase Console → Authentication → Settings → Authorized domains** وأضفه. لا تضف نطاقاً غير موثوق.

## 6. فحص المعاينة يدوياً

بعد نجاح بناء المعاينة:
1. افتح رابط Preview.
2. اختبر تسجيل الدخول بالبريد وكلمة المرور، وGoogle، والدخول كضيف.
3. أنشئ حالة نصية وتأكد من ظهورها وفق قواعد الصلاحيات.
4. افتح محادثة واختبر إرسال رسالة.
5. تصفح الأكاديمية والمناهج المنشورة.
6. تحقق أن `/api/v1/health` يعيد JSON بحالة `ok`.
7. لا تعتبر HTTP 200 لصفحة أو 405 لمسار API دليلاً على نجاح POST أو Firestore؛ اختبر العمليات الفعلية بحسابات اختبار مخصصة وعلى المعاينة.

## 7. منح صلاحية المشرف من جهاز المالك فقط

شغّل `functions/scripts/grant-admin.cjs` محلياً. يتطلب اعتماد Google Application Default Credentials لخدمة تملك صلاحية إدارة Firebase Authentication. إذا استخدمت ملف اعتماد محلياً، أبقه خارج المستودع:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/imi-admin-service-account.json"
export GCLOUD_PROJECT="imi-indroid"
export IMI_ADMIN_UID="<UID>"
export CONFIRM_GRANT_IMI_ADMIN="GRANT_ADMIN_TO_<UID>"
node functions/scripts/grant-admin.cjs
```
استبدل `<UID>` بمعرّف الحساب المقصود في السطرين. يتحقق السكربت من المشروع `imi-indroid` ومن قيمة التأكيد، ثم يضيف claim باسم `admin: true` مع الاحتفاظ بالـclaims السابقة ويعيد قراءتها للتحقق. بعد النجاح يجب على الحساب تحديث ID token/تسجيل الدخول مجدداً. لا تشغّل الأمر لحساب آخر ولا تضع ملف الاعتماد في المستودع أو السجلات. لا تنفذ هذه الخطوة إلا بموافقة المالك.

بعد منح الصلاحية، افتح لوحة المشرف، واستورد `data/curriculum.json`، ثم استخدم **معاينة النشر** أولاً، وبعد مراجعة العدد والعناصر استخدم **نشر الهيكل** لكل مستوى على حدة.

## 8. نشر قواعد Firestore والفهارس — يدوي وبموافقة منفصلة

لا تنفّذ هذه الخطوة إلا بعد اخضرار CI وموافقة المالك الصريحة على تغيير Firebase الحقيقي. من جهاز المالك:
```bash
npx firebase-tools@15.37.0 login
npx firebase-tools@15.37.0 use imi-indroid
npx firebase-tools@15.37.0 deploy --only firestore:rules,firestore:indexes
```
هذا الأمر ينشر قواعد Firestore وفهارسه فقط. لا تضف `storage` أو `functions`، ولا تفعّل Cloud Functions. راجع الـdiff في ملفات القواعد والفهارس قبل الموافقة.

## 9. بناء Android على نطاق المعاينة

من جذر المشروع:
```bash
./gradlew assembleDebug -PIMI_API_BASE_URL=https://<نطاق-المعاينة>
```
استخدم أصل النطاق فقط دون `/api` أو مسار إضافي. ضع `app/google-services.json` محلياً ومن مشروع Firebase نفسه؛ يجب أن يبقى متجاهلاً في Git ولا ترفعه إلى المستودع.

## 10. ممنوعات ثابتة

- لا ترقية إلى Blaze، ولا بطاقة دفع، ولا خدمة مدفوعة.
- لا تفعيل `IMI_ADMIN_HEALTH` أو `IMI_ACCOUNT_DELETION_ENABLED` في الاستضافة.
- لا تفعيل Emulator flags أو عناوين Emulator في الاستضافة.
- لا نشر Production، ولا دمج PR #2، ولا نشر Cloud Functions.
- لا ترفع أسرار Firebase Admin أو ملفات الاعتماد إلى Git أو السجلات.
- لا تفتح ميزات رفع الملفات/الفيديو قبل إثبات أهلية Storage على Spark ومراجعة قواعده.

## 11. بوابة ما قبل أي إطلاق تجاري

- Vercel Hobby هنا للمعاينة الشخصية غير التجارية فقط؛ لا تعتبره مضيفاً تجارياً معتمداً.
- توافق Cloudflare Workers مع Firebase Admin Firestore **غير مثبت**؛ اختبار Worker الحالي يفشل عند dynamic code generation داخل `protobufjs` المستدعى من `firebase-admin/firestore`.
- قبل أي إطلاق تجاري، إما تقديم اختبار موثق يثبت توافق Cloudflare، أو اختيار مضيف Node مجاني يسمح بالاستخدام التجاري وفق شروطه الحالية والتحقق من حدود الخطة وقيودها. لا تفترض أن أي خطة مجانية تسمح بالتجاري دون مراجعة شروطها.
- لا يتم أي نشر إنتاجي أو ترقية خطة أو دفع أو دمج PR دون موافقة صريحة مستقلة من المالك.
