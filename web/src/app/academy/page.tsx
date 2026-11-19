import Link from 'next/link';
import AcademyPanel from '@/components/academy-panel';
import CurriculumBrowser from '@/components/curriculum-browser';

export default function PublicAcademyPage() {
  return (
    <main dir="rtl" className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-8">
      <header className="mb-6 flex items-center justify-between border-b border-white/10 pb-5">
        <Link href="/" className="text-3xl font-black tracking-widest text-blue-400">IMI</Link>
        <div className="flex items-center gap-2"><Link href="/teacher/apply" className="rounded-xl border border-violet-400/30 px-3 py-2 text-sm text-violet-200 hover:bg-violet-400/10">أصبح أستاذاً</Link><Link href="/login" className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-200 hover:border-blue-400">
          تسجيل الدخول لحفظ التقدم سحابياً
        </Link>
      </header>
      <div className="mb-6 rounded-2xl border border-blue-400/20 bg-blue-500/5 p-4 text-sm leading-7 text-slate-300">
        يمكنك تصفح الدروس المنشورة دون إنشاء حساب. يُحفظ تقدم الزائر محلياً على هذا الجهاز؛ سجّل الدخول لمزامنته عبر حسابك.
      </div>
      <CurriculumBrowser />
      <div className="my-8 border-t border-white/10" />
      <AcademyPanel user={null} />
    </main>
  );
}
