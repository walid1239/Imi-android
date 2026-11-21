export default function TeacherApplicationPanel() {
  return <main dir="rtl" className="mx-auto min-h-screen max-w-3xl px-4 py-8 text-slate-100">
    <header className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-slate-950 p-6">
      <p className="text-xs font-bold text-violet-300">IMI ACADEMY · TEACHERS</p>
      <h1 className="mt-3 text-2xl font-black">طلب الانضمام كأستاذ</h1>
      <p className="mt-2 text-sm leading-7 text-slate-400">نموذج طلب الأستاذ متوقف مؤقتاً في المرحلة المجانية الأولى.</p>
    </header>
    <p className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm leading-7 text-amber-100">يتطلب توثيق الأستاذ رفع وثائق إثبات. تم إيقاف الرفع مؤقتاً لتجنب استدعاء Firebase Storage على خطة Spark. لن تُرسل أي وثيقة أو طلب غير مكتمل. ستعود هذه الميزة بعد اعتماد مزود تخزين مجاني مناسب ومراجعته أمنياً.</p>
  </main>;
}
