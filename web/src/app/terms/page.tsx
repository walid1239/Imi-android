import Link from 'next/link';

export default function TermsPage() {
  return (
    <main dir="rtl" className="mx-auto min-h-screen max-w-3xl px-5 py-10 text-slate-100">
      <Link href="/" className="text-xl font-black text-blue-400">IMI</Link>
      <h1 className="mt-8 text-3xl font-black">شروط الاستخدام</h1>
      <p className="mt-2 text-xs text-slate-500">مسودة ما قبل الإطلاق · آخر تحديث: 19 نوفمبر 2026</p>
      <div className="mt-8 space-y-6 text-sm leading-8 text-slate-300">
        <section><h2 className="font-bold text-white">1. قبول الشروط</h2><p>تحدد هذه المسودة قواعد استخدام منصة IMI الاجتماعية والتعليمية. يجب اعتماد نسخة نهائية بعد تحديد الجهة المشغلة والسن الأدنى والقانون المختص وآلية الشكاوى.</p></section>
        <section><h2 className="font-bold text-white">2. الاستخدام المقبول</h2><p>يلتزم المستخدم بعدم انتحال الهوية أو التحرش أو التهديد أو نشر البرمجيات الضارة أو المحتوى غير القانوني أو انتهاك حقوق الملكية الفكرية أو محاولة الوصول إلى حسابات وبيانات الغير.</p></section>
        <section><h2 className="font-bold text-white">3. المحتوى والحقوق</h2><p>يبقى المستخدم مسؤولاً عن امتلاكه حقوق المحتوى الذي يرفعه أو حصوله على الإذن اللازم. يجب أن تحمل الدروس المنشورة بيانات مصدر وترخيص أو إذن ومراجعة. يمكن الإبلاغ عن انتهاك الحقوق، ويجب استكمال مسار معالجة البلاغات قبل الإطلاق.</p></section>
        <section><h2 className="font-bold text-white">4. السلامة والقاصرون</h2><p>يُحظر طلب أو نشر بيانات الاتصال الخاصة للقاصرين أو نقلهم إلى قنوات خاصة غير مراقبة. لا يجوز تشغيل البث أو الدردشة التعليمية للقاصرين قبل اكتمال ضوابط الإشراف والكتم والطرد والتبليغ وحماية البيانات.</p></section>
        <section><h2 className="font-bold text-white">5. الإشراف والحسابات</h2><p>قد تُقيّد الحسابات أو المحتويات المخالفة بعد مراجعة مناسبة. صلاحيات المشرفين يجب أن تمنح من جهة موثوقة، ولا يمكن للمستخدم رفع صلاحيات حسابه من الواجهة.</p></section>
        <section><h2 className="font-bold text-white">6. توفر الخدمة</h2><p>قد تتوقف بعض الميزات أو تتغير أثناء التطوير. لا تُعدّ الشيفرة أو واجهة تجريبية ضماناً لتوفر خدمة إنتاجية أو اتصال مستمر أو تخزين دائم.</p></section>
        <section><h2 className="font-bold text-white">7. حدود هذه المسودة</h2><p className="text-amber-300">هذه مسودة أولية وليست شروطاً نهائية. يلزم إدراج اسم الجهة المشغلة ووسائل التواصل والسن الأدنى والاختصاص القضائي وتسوية النزاعات وسياسة الإنهاء بعد مراجعة قانونية.</p></section>
      </div>
      <footer className="mt-10 border-t border-white/10 pt-5 text-sm"><Link href="/privacy" className="text-blue-300">سياسة الخصوصية</Link> · <Link href="/" className="text-blue-300">الرئيسية</Link></footer>
    </main>
  );
}
