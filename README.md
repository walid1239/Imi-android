# IMI — Native Android project

مشروع Android أصلي باسم IMI، مبني بـ Kotlin وJetpack Compose، دون WebView.

## الحالة الحالية
هذا مستودع المصدر التأسيسي. يحتوي على واجهات Compose وهيكل طبقات أولي، وليس تطبيقاً اجتماعياً مكتملاً بعد. لا توجد حالياً مصادقة Firebase حقيقية أو مزامنة رسائل أو رفع وسائط أو Reels أو مكالمات WebRTC عاملة.

## البناء
- JDK 17
- Android SDK 35
- Gradle 8.9 (يستخدمه GitHub Actions)
- Package: `com.walid.chat`

افتح المشروع في Android Studio، ثم نفّذ Gradle Sync. سير العمل `.github/workflows/android-build.yml` يبني Debug APK غير موقّع ويرفعه كـ Artifact باسم `IMI-debug-apk`.

## Firebase
اعتماديات Firebase Auth/Firestore/Storage معلنة فقط. لم يتم تضمين `google-services.json` أو أسرار. يلزم إعداد Firebase ومراجعة Security Rules قبل تفعيل أي خدمة.

لا تعتبر وجود الواجهات أو المكتبات دليلاً على أن الميزات الخلفية تعمل.
