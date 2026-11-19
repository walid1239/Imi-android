'use client';

import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/client';
import ChatPanel from '@/components/chat-panel';
import ReelsPanel from '@/components/reels-panel';
import StatusPanel from '@/components/status-panel';

const tabs = [
  { label: 'المحادثات', icon: '💬', description: 'محادثاتك المتزامنة مع تطبيق IMI.' },
  { label: 'الحالات', icon: '◉', description: 'تابع حالات أصدقائك وشارك تحديثاتك.' },
  { label: 'Reels', icon: '▶', description: 'شاهد مقاطع الفيديو القصيرة.' },
  { label: 'الأكاديمية', icon: '▤', description: 'تابع الدروس وتقدمك التعليمي.' },
  { label: 'ملفي', icon: '●', description: 'أدر معلومات ملفك الشخصي.' },
];

export default function AppHomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => onAuthStateChanged(auth, current => {
    setUser(current);
    setReady(true);
    if (!current) router.replace('/login');
  }), [router]);

  async function logout() {
    await signOut(auth);
    router.replace('/login');
  }

  if (!ready || !user) return <main className="grid min-h-screen place-items-center text-slate-400">جارٍ التحقق من الجلسة…</main>;

  return <main dir="rtl" className="mx-auto min-h-screen max-w-6xl px-4 pb-24 pt-6 sm:px-8">
    <header className="flex items-center justify-between border-b border-white/10 pb-5">
      <Link href="/" className="text-3xl font-black tracking-widest text-blue-400">IMI</Link>
      <div className="flex items-center gap-3"><span className="hidden max-w-48 truncate text-sm text-slate-400 sm:inline">{user.email ?? user.uid}</span><button onClick={logout} className="rounded-xl border border-white/15 px-4 py-2 text-sm">خروج</button></div>
    </header>
    <section className="py-8"><p className="text-sm text-blue-300">مساحتك الشخصية</p><h1 className="mt-2 text-3xl font-black">أهلاً بك في IMI</h1><p className="mt-2 text-sm text-slate-400">بيانات المحادثات تُقرأ وتُحدّث مباشرة من مشروع Firebase نفسه.</p></section>
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 sm:p-5">
      <div className="flex flex-wrap gap-2">{tabs.map((tab, index) => <button key={tab.label} onClick={() => setActive(index)} aria-pressed={active === index} className={`rounded-xl px-4 py-3 text-sm font-semibold ${active === index ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-300'}`}>{tab.icon} {tab.label}</button>)}</div>
      <div className="mt-5">
        {active === 0 ? <ChatPanel user={user} /> : active === 1 ? <StatusPanel user={user} /> : active === 2 ? <ReelsPanel user={user} /> : <div className="min-h-48 rounded-2xl bg-white/[.035] p-6"><h2 className="text-xl font-bold">{tabs[active].label}</h2><p className="mt-3 leading-7 text-slate-400">{tabs[active].description}</p><p className="mt-4 text-xs text-slate-500">هذا القسم لم يُربط ببيانات Firebase بعد؛ لا نعرض محتوى تجريبياً على أنه حقيقي.</p></div>}
      </div>
    </section>
    <nav aria-label="التنقل الرئيسي" className="fixed inset-x-0 bottom-0 z-10 border-t border-white/10 bg-slate-950/95 px-2 py-3 backdrop-blur sm:hidden"><div className="mx-auto flex max-w-lg justify-around">{tabs.map((tab, index) => <button key={tab.label} onClick={() => setActive(index)} aria-pressed={active === index} className={`flex flex-col items-center gap-1 text-xs ${active === index ? 'text-blue-300' : 'text-slate-400'}`}><span className="text-lg">{tab.icon}</span>{tab.label}</button>)}</div></nav>
  </main>;
}
