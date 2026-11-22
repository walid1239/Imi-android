export default function TeacherApplicationPanel() {
  return (
    <main dir="rtl" className="mx-auto min-h-screen max-w-3xl px-4 py-8 text-slate-100">
      <header className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-slate-950 p-6">
        <p className="text-xs font-bold text-violet-300">IMI ACADEMY · TEACHERS</p>
        <h1 className="mt-3 text-2xl font-black">طلب الانضمام كأستاذ</h1>
        <p className="mt-2 text-sm leading-7 text-slate-400">
          نعمل على استكمال إجراءات مراجعة طلبات الأساتذة وحماية بيانات المتعلمين قبل فتح التقديم.
        </p>
      </header>

      <section
        role="status"
        aria-live="polite"
        className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5 text-sm leading-7 text-amber-100"
      >
        <h2 className="font-bold">التقديم متوقف مؤقتاً</h2>
        <p className="mt-2">
          لا نطلب منك إدخال بيانات شخصية أو رفع شهادة في هذه المرحلة. سنفتح التقديم بعد اكتمال
          مراجعة إجراءات التوثيق وحماية البيانات.
        </p>
      </section>
    </main>
  );
}
