# ترحيل دروس Android القديمة إلى «مهارات عامة»

المصدر: `app/src/main/java/com/walid/chat/ui/IMIApp.kt` داخل `AcademyScreen`.

تم استخراج الدروس الثلاثة الأصلية كما هي إلى `data/general-skills-android-migration.json`:
1. التعلّم الذاتي — خطوات عملية لبناء عادة تعلّم مستمرة.
2. اللغة الإنجليزية — ابدأ بالمفردات والجمل اليومية.
3. أساسيات البرمجة — افهم المتغيرات والشروط والحلقات.

## سياسة الترحيل

- تُنشأ دورة باسم «مهارات عامة» في مجموعة `courses`.
- الدروس الثلاثة تُنشأ كمسودات فقط: `published=false`, `needsHumanReview=true`, `reviewStatus=pending`.
- لا تُضاف أي وثيقة درس إلى شجرة `curriculumNodes`؛ يظل seed المنهاج خالياً من الدروس كما طلبت.
- يجب على مشرف مراجعة النصوص والتأكد من الحقوق ثم نشرها يدوياً من لوحة الإدارة.
- السكربت يرفض الكتابة فوق دورة موجودة بنفس المعرّف، ولا يحذف بيانات.
- لم يتم تشغيل السكربت على Firebase الحقيقي.

## تشغيل المحاكي

```bash
firebase emulators:start --only firestore --project demo-imi-general-skills
node scripts/seed-general-skills.cjs --emulator --project=demo-imi-general-skills
```

## الإنتاج — أمر يدوي منفصل غير منفّذ

```bash
node scripts/seed-general-skills.cjs --production --project=imi-indroid --confirm=imi-indroid
```

يتطلب Application Default Credentials وصلاحية كتابة Firestore. لا يشغّل هذا الأمر إلا بعد مراجعة المسودات والموافقة الصريحة على إدخالها إلى قاعدة الإنتاج.
