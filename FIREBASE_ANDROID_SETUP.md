# إعداد Firebase لتطبيق IMI

هذه الوثيقة تشرح ربط مشروع Firebase حقيقي. **لا يوجد حاليًا مشروع Firebase مؤكد الملكية ومربوط بالتطبيق، ولم تُنشر Functions أو Firestore أو Storage.** لا تستخدم معرّف مشروع قديمًا لمجرد أنه موجود في ملفات سابقة.

## 1. إنشاء المشروع وربط تطبيق Android

1. أنشئ أو اختر مشروع Firebase تملكه أنت من https://console.firebase.google.com/ .
2. سجّل معرّف المشروع الحقيقي من Project settings. لا تفترض أن `cosmic-altar-m6shk` هو المشروع الصحيح؛ يجب أن تؤكد ذلك من حسابك.
3. أضف تطبيق Android بمعرّف الحزمة الدقيق `com.walid.chat`.
4. نزّل `google-services.json` الخاص بهذا التطبيق.
5. فعّل Firebase Authentication > Anonymous مؤقتًا للاختبار فقط.
6. أنشئ Firestore Database وStorage في المنطقة التي تختارها. راجع قواعد الأمان قبل أي بيانات إنتاجية.
7. لا تضع مفاتيح Admin أو Meta في التطبيق أو المستودع.

## 2. إعداد بناء Android في GitHub

لإنتاج APK مهيأ لمشروعك، أضف GitHub Actions secret باسم `GOOGLE_SERVICES_JSON_BASE64` وقيمته محتوى ملف `google-services.json` بعد ترميزه Base64. مثال Linux/macOS:

```sh
base64 -w 0 google-services.json
```

أدخل الناتج في GitHub > Settings > Secrets and variables > Actions. أضف أيضًا secret باسم `FIREBASE_PROJECT_ID` بالقيمة نفسها التي يعرضها Firebase Console لمشروعك. يتحقق CI من تطابق معرّف المشروع داخل الملف مع هذا السر، ومن اسم الحزمة `com.walid.chat`؛ إذا غاب أحد السرّين مع وجود ملف الإعداد فسيفشل التحقق بدل إنشاء APK مربوط بمشروع غير مقصود. إذا لم يوجد `GOOGLE_SERVICES_JSON_BASE64` أصلًا، ينجح بناء الاختبارات لكن ينتج APK بلا ربط Firebase. لا ترسل الملف أو محتواه أو مفاتيح خاصة في المحادثة.

## 3. إعداد النشر السحابي عبر GitHub OIDC

أُضيف workflow يدوي في `.github/workflows/firebase-deploy.yml`. لا ينشر تلقائيًا. يحتاج إعداد Workload Identity Federation في Google Cloud، وحساب خدمة مخصص للنشر، وصلاحيات Firebase/Google Cloud اللازمة. لا تستخدم مفتاح JSON دائمًا.

في GitHub أنشئ Environment باسم `firebase-production`، وأضف Environment secrets التالية:

- `FIREBASE_PROJECT_ID`: معرّف المشروع الوحيد المسموح بالنشر إليه؛ يجب أن يطابق المشروع الذي تملكه وتتحقق منه.
- `GCP_WORKLOAD_IDENTITY_PROVIDER`: المورد الكامل لمزوّد Workload Identity Provider.
- `FIREBASE_DEPLOY_SERVICE_ACCOUNT`: البريد الإلكتروني لحساب الخدمة المخصص للنشر.

يتحقق Workflow من تطابق معرّف الإدخال مع `FIREBASE_PROJECT_ID` قبل المصادقة والنشر، ويشغّل اختبارات Firestore وStorage في Emulator Suite ويبني Functions قبل النشر. يجب ضبط الأسرار الثلاثة داخل Environment `firebase-production`، مع حماية البيئة بمراجعة يدوية إن كانت متاحة.

في Google Cloud، أنشئ Workload Identity Pool/Provider مع GitHub OIDC، واجعل شرط السماح مقيدًا بالمستودع `walid1239/Imi-android` وبالفرع `feature/server-authoritative-status` (أو الفرع الإنتاجي الذي تقرره لاحقًا). اربط الهوية بحساب خدمة محدود الصلاحيات، ولا تمنح صلاحيات Owner أو Editor العامة. يجب تفعيل واجهات Google Cloud المطلوبة وإعداد فوترة مناسبة لخدمات Cloud Functions إن طلبتها Google.

بعد إعداد الهوية والمشروع، شغّل GitHub Actions > IMI Firebase Cloud Deployment يدويًا، واختر فرع التغيير، وأدخل معرّف مشروعك المؤكد، واكتب `DEPLOY` للتأكيد. سيبني workflow Functions ثم ينشر Functions وFirestore rules وStorage rules إلى المشروع المحدد. نجاح workflow وحده لا يغني عن اختبار التطبيق من جهاز فعلي.

**تنبيه:** لا تشغّل workflow قبل مراجعة المشروع المستهدف والقواعد وصلاحيات حساب الخدمة. هذا الإعداد ليس دليلًا على أن أي خدمة نُشرت بالفعل.

## 4. تسجيل الدخول وWhatsApp OTP

التطبيق يستخدم Firebase Anonymous Authentication مؤقتًا؛ هذا لا يثبت رقم الهاتف ولا يحقق تسجيل الدخول النهائي. WhatsApp OTP غير منفذ حاليًا. يتطلب Meta WhatsApp Business Cloud API، حساب WhatsApp Business مهيأ، قالب Authentication معتمدًا، أسرار Meta على الخادم، حدود إرسال ومحاولات، انتهاء الرمز واستخدامه مرة واحدة، ثم إصدار Firebase Custom Token بعد التحقق. لا تضع Meta access token أو Firebase Admin credentials داخل APK أو المستودع.

لا تعلن أن OTP يعمل قبل اكتمال الخادم واختبار الإرسال والتحقق والاستعادة على أجهزة حقيقية، ووضع خطة آمنة لترحيل حسابات Anonymous الموجودة.

## 5. وظيفة الحالات

يوجد أساس Cloud Function باسم `createStatus` لإنشاء الحالة بوقت خادم وانتهاء بعد 28 ساعة، مع تحقق من المدخلات ومهلة نشر. التطبيق يستدعي الوظيفة قبل رفع صورة الحالة. هذا الكود موجود في المستودع، لكنه لا يعمل على Firebase الإنتاجي قبل نشره بنجاح.

## 6. ما لم يكتمل بعد

- ربط مشروع Firebase فعلي تملكه ونشر خدماته.
- تسجيل الهاتف عبر WhatsApp OTP.
- تدفقات طلب/قبول الصداقة الموثوقة على الخادم.
- حضور المستخدم والإشعارات وإيصالات التسليم والقراءة.
- اكتمال المكالمات واختبارات الصوت/الفيديو بين أجهزة وشبكات مختلفة.
- مراجعة شاملة للقواعد ومخطط البيانات واختبار اختراق قبل الإنتاج.

نجاح Gradle أو اختبارات Firebase Emulator لا يثبت اتصال Firebase الإنتاجي أو اكتمال ميزات التطبيق.
