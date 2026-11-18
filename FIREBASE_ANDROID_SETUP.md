# إعداد Firebase لتطبيق IMI

المشروع يستخدم الحزمة Android التالية: `com.walid.chat`.

## إعداد التطبيق في Firebase Console

1. افتح مشروع Firebase المقصود: `cosmic-altar-m6shk`.
2. من Project settings > Your apps، أضف تطبيق Android بالحزمة الدقيقة `com.walid.chat` (أو اختره إذا كان موجوداً).
3. نزّل ملف `google-services.json` الخاص بهذا التطبيق.
4. فعّل Authentication > Sign-in method > Anonymous.
5. أنشئ Firestore Database وStorage في المنطقة التي تختارها للمشروع.
6. لا تضع مفاتيح Service Account أو مفاتيح Admin داخل التطبيق أو المستودع.

## مكان الملف

ضع الملف محلياً في:

```
app/google-services.json
```

لا ترفع الملف إلى GitHub العام. لا يحتوي ملف إعداد Android عادةً على مفتاح Admin، لكنه يعرّف التطبيق ومشروع Firebase؛ نفضّل حفظه كسرّ CI وتوليد الملف أثناء GitHub Actions.

## سلوك الجلسة

يستخدم IMI Firebase Anonymous Authentication لإنشاء UID تلقائي دون OTP. تبقى الجلسة محفوظة على الجهاز عادةً، لكن حذف بيانات التطبيق أو إعادة تثبيته قد يفقد الوصول إلى الحساب المجهول. هذه الطريقة لا تثبت رقم الهاتف ولا توفر استعادة حساب تلقائية. ربط الحساب بوسيلة استرداد آمنة مرحلة لاحقة.

## ما يجب التحقق منه قبل النشر

- تأكد أن `project_id` في الملف هو `cosmic-altar-m6shk`.
- تأكد أن `package_name` هو `com.walid.chat`.
- لا تنشر قواعد Firebase إلى الإنتاج قبل اختبارها على المشروع الصحيح ومراجعة مخطط الصداقة.
- بعد توفير إعداد التطبيق، أضف Google Services Gradle plugin وشغّل التطبيق على جهازين لاختبار UID والمحادثات بينهما.
