# تشخيص Firebase Authentication في IMI

## نتيجة فحص المستودع

- الويب يقرأ إعداد Firebase من متغيرات `NEXT_PUBLIC_FIREBASE_*` في `web/src/lib/firebase/client.ts`.
- المتغيرات المطلوبة حالياً: `API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID`.
- عند غياب أي قيمة، يستعمل البناء إعداداً وهمياً محلياً باسم المشروع `imi-indroid` فقط لتسمح Next.js بالبناء. هذا الإعداد لا يتصل بمشروع Firebase حقيقي.
- صفحة الدخول كانت تعرض رسالة Firebase الخام عند أخطاء التهيئة؛ أصبحت تعرض رسائل عربية موجهة حسب رمز الخطأ.
- التطبيق يستخدم Email/Password وGoogle وAnonymous. لا يوجد OTP في تدفق الويب الحالي.
- ملف `google-services.json` غير موجود في المستودع، وهذا متوقع لحماية إعدادات التطبيق. إعداد Android يُمرر إلى CI عبر GitHub Actions secrets حسب `FIREBASE_ANDROID_SETUP.md`.
- لا يمكن قراءة متغيرات بيئة الاستضافة أو لوحة Firebase من المستودع، لذلك لا يمكن تحديد ما إذا كانت Authentication معطلة أو إذا كان إعداد الويب/مفتاح API لا يطابق `imi-indroid`. يجب تأكيد ذلك من لوحة Firebase.

## خطوات مطلوبة منك في Firebase Console

تأكد أنك داخل المشروع الذي يعرض Project ID بالضبط `imi-indroid` ورقم المشروع `135769436246`.

1. افتح **Authentication → Get started**. إذا لم تكن الخدمة مفعّلة، ابدأ إعدادها.
2. افتح **Authentication → Sign-in method** وفعّل:
   - **Email/Password** (الخيار الأول Email/Password، وليس Email link فقط).
   - **Google**، واختر بريد دعم المشروع عند طلبه.
   - **Anonymous** لأن زر الضيف الحالي يستعمل `signInAnonymously`.
3. افتح **Authentication → Settings → Authorized domains** وأضف نطاق الموقع الفعلي الذي تفتح منه IMI، مع عدم الاكتفاء بـ `localhost`. لا تضف نطاقاً لا تملكه.
4. افتح **Project settings → General → Your apps**:
   - اختر تطبيق Web المسجل في هذا المشروع. إذا لم يوجد، سجّل تطبيق Web جديداً باسم IMI.
   - انسخ قيم إعداد Firebase الخاصة بتطبيق Web من SDK setup، وقارنها حرفياً بمتغيرات الاستضافة:
     `NEXT_PUBLIC_FIREBASE_API_KEY`
     `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
     `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
     `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
     `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
     `NEXT_PUBLIC_FIREBASE_APP_ID`
   - يجب أن يكون `PROJECT_ID=imi-indroid` و`MESSAGING_SENDER_ID=135769436246`. أما API key وAuth domain وApp ID فيجب أخذها من تطبيق Web نفسه، لا تخمينها.
5. في Google Cloud Console للمشروع نفسه، إذا كان مفتاح API عليه قيود، تأكد أن قيود HTTP referrers تسمح بنطاق IMI وأن قيود API لا تمنع Identity Toolkit / Firebase Authentication. لا تزل القيود عشوائياً؛ أضف النطاق والواجهات المطلوبة فقط.
6. لا ترسل API key أو ملف `google-services.json` أو أي سر في المحادثة. مفاتيح Firebase Web الظاهرة للعميل ليست مفاتيح Admin، لكن يجب أن تكون مقيدة ومحمية بقواعد Firebase وApp Check عند تفعيله.

## كيف نتحقق بعد التعديل

- بعد ضبط متغيرات الاستضافة، أعد تشغيل/إعادة نشر موقع الويب من لوحة الاستضافة وفق آليتك. لا ينفذ هذا المستودع أي نشر.
- افتح صفحة الدخول وجرب حساباً اختبارياً عبر Email/Password، ثم Google، ثم ضيفاً. لا تستخدم حساباً فعلياً قبل نجاح الاختبار.
- إذا استمر الخطأ، أرسل **رمز الخطأ فقط** (مثلاً `auth/configuration-not-found` أو `auth/operation-not-allowed`) واسم طريقة الدخول التي فشلت، دون بريد أو مفاتيح أو بيانات شخصية.
- نجاح TypeScript أو Build أو Firebase Emulator لا يثبت تفعيل Authentication على المشروع الحقيقي.

## حدود العمل الآمن

هذا التغيير لا يغير مشروع Firebase، ولا ينشئ تطبيقاً أو مزود دخول، ولا يغير مفاتيح أو أسرار، ولا ينشر أي خدمة. لم يبدأ تعديل الأكاديمية السحابية؛ سننتظر تأكيد زوال خطأ التهيئة أولاً كما طلبت.
