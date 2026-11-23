import Link from 'next/link';

const sections = [
  { href: '/login', title: 'المحادثات', detail: 'تواصل مع أصدقائك برسائل متزامنة.' },
  { href: '/login', title: 'الحالات', detail: 'شارك لحظاتك وتابع تحديثات أصدقائك.' },
  { href: '/login', title: 'Reels', detail: 'اكتشف مقاطع الفيديو القصيرة.' },
  { href: '/academy', title: 'الأكاديمية', detail: 'تعلّم وتابع تقدمك دون حساب.' },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8">
      <header className="flex items-center justify-between border-b border-white/10 pb-5">
        <Link href="/" className="text-3xl font-black tracking-widest text-blue-400">IMI</Link>
        <Link href="/login" className="rounded-full border border-white/20 px-5 py-2 text-sm hover:bg-white/10">تسجيل الدخول</Link>
      </header>
      <section className="grid flex-1 items-center gap-10 py-16 md:grid-cols-[1.1fr_.9fr]">
        <div>
          <p className="mb-4 text-sm font-semibold text-blue-300">منصة واحدة لكل تواصلك</p>
          <h1 className="max-w-2xl text-4xl font-black leading-tight sm:text-6xl">تواصل، شارك، وتعلّم مع <span className="text-blue-400">IMI</span></h1>
          <p className="mt-6 max-w-xl text-lg leading-9 text-slate-300">مساحة عربية تجمع المحادثات والحالات ومقاطع الفيديو القصيرة والتعليم، مع تجربة مصممة للهاتف أولاً.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-xl bg-blue-600 px-7 py-3 font-bold shadow-lg shadow-blue-950/40 hover:bg-blue-500">ابدأ الآن</Link>
            <a href="/api/app/download-apk" className="rounded-xl border border-blue-400/50 px-7 py-3 font-semibold text-blue-200 hover:bg-blue-500/10">تنزيل تطبيق Android</a>
            <a href="#features" className="rounded-xl border border-white/15 px-7 py-3 font-semibold hover:bg-white/5">اكتشف IMI</a>
          </div>
          <p className="mt-3 text-xs text-slate-500">نسخة معاينة Android؛ قد لا يتوفر ملف التثبيت حتى نشر البناء يدوياً.</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-blue-950/30">
          <div className="mb-5 flex items-center gap-3"><div className="grid size-12 place-items-center rounded-2xl bg-blue-600 text-xl font-black">I</div><div><p className="font-bold">مساحتك في IMI</p><p className="text-sm text-slate-400">كل ما تحتاجه في مكان واحد</p></div></div>
          <div className="space-y-3">{sections.map((item) => <Link key={item.title} href={item.href} className="block rounded-2xl border border-white/10 bg-white/[.035] p-4 transition hover:border-blue-400/50 hover:bg-blue-500/10"><div className="font-bold">{item.title}</div><div className="mt-1 text-sm text-slate-400">{item.detail}</div></Link>)}</div>
        </div>
      </section>
      <section id="features" className="grid gap-4 border-t border-white/10 py-8 sm:grid-cols-2 lg:grid-cols-4">{sections.map((item) => <div key={item.title} className="rounded-2xl bg-white/[.035] p-4"><h2 className="font-bold">{item.title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{item.detail}</p></div>)}</section>
      <footer className="flex flex-wrap items-center justify-center gap-4 border-t border-white/10 py-5 text-xs text-slate-500"><span>IMI · تواصل وتعلّم</span><Link href="/privacy" className="hover:text-blue-300">الخصوصية</Link><Link href="/terms" className="hover:text-blue-300">شروط الاستخدام</Link><Link href="/academy" className="hover:text-blue-300">الأكاديمية</Link></footer>
    </main>
  );
}
