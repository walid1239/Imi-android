import Link from 'next/link';

export default function FirebaseConfigRequired() {
  return (
    <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-950 px-5 py-10 text-slate-100">
      <section className="w-full max-w-xl rounded-3xl border border-amber-400/20 bg-slate-900/80 p-7">
        <p className="text-xs font-bold tracking-widest text-amber-300">IMI · CONFIGURATION</p>
        <h1 className="mt-4 text-2xl font-black">إعداد Firebase غير مكتمل</h1>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          لم نبدأ تسجيل الدخول أو تحميل بيانات الحساب لأن إعداد Firebase لتطبيق الويب غير مكتمل.
          لن نستخدم عنوان localhost احتياطياً ولن نعرض بيانات تجريبية على أنها بيانات حقيقية.
        </p>
        <p className="mt-4 text-sm font-semibold">تحقق من متغيرات البيئة التالية في إعدادات الاستضافة:</p>
        <ul className="mt-2 list-disc space-y-1 pr-6 text-xs leading-6 text-slate-400">
          <li>NEXT_PUBLIC_FIREBASE_API_KEY</li>
          <li>NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN</li>
          <li>NEXT_PUBLIC_FIREBASE_PROJECT_ID</li>
          <li>NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET</li>
          <li>NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID</li>
          <li>NEXT_PUBLIC_FIREBASE_APP_ID</li>
        </ul>
        <Link href="/" className="mt-6 inline-flex rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold hover:bg-white/5">
          العودة إلى الصفحة الرئيسية
        </Link>
      </section>
    </main>
  );
}
