'use client';

import { getIdTokenResult, onAuthStateChanged, signOut, User } from 'firebase/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { auth, firebaseConfigured } from '@/lib/firebase/client';
import FirebaseConfigRequired from '@/components/firebase-config-required';
import ChatPanel from '@/components/chat-panel';
import ReelsPanel from '@/components/reels-panel';
import StatusPanel from '@/components/status-panel';
import ProfilePanel from '@/components/profile-panel';
import FriendsPanel from '@/components/friends-panel';
import AcademyPanel from '@/components/academy-panel';
import AcademyAdminPanel from '@/components/academy-admin-panel';
import NotificationsPanel from '@/components/notifications-panel';

const tabs = [
  { label: 'المحادثات', icon: '💬', description: 'محادثاتك المتزامنة مع تطبيق IMI.' },
  { label: 'الحالات', icon: '◉', description: 'تابع حالات أصدقائك وشارك تحديثاتك.' },
  { label: 'Reels', icon: '▶', description: 'شاهد مقاطع الفيديو القصيرة.' },
  { label: 'الأكاديمية', icon: '▤', description: 'تابع الدروس وتقدمك التعليمي.' },
  { label: 'ملفي', icon: '●', description: 'أدر معلومات ملفك الشخصي.' },
  { label: 'الأصدقاء', icon: '♧', description: 'ابحث عن أصدقاء وأدر طلبات الصداقة.' },
];

export default function AppHomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!firebaseConfigured) { setReady(true); return; }
    return onAuthStateChanged(auth, current => {
      setUser(current);
      setReady(true);
      if (!current) router.replace('/login');
    });
  }, [router]);

  useEffect(() => {
    if (!firebaseConfigured || !user) { setIsAdmin(false); return; }
    let current = true;
    getIdTokenResult(user, true).then(token => { if (current) setIsAdmin(token.claims.admin === true); })
      .catch(() => { if (current) setIsAdmin(false); });
    return () => { current = false; };
  }, [user]);

  const visibleTabs = isAdmin ? [...tabs, { label: 'إدارة الأكاديمية', icon: '⚙', description: 'إنشاء الدورات والدروس ونشرها.' }] : tabs;

  async function logout() {
    await signOut(auth);
    router.replace('/login');
  }

  if (!firebaseConfigured) return <FirebaseConfigRequired />;
  if (!ready || !user) return <main className="grid min-h-screen place-items-center text-slate-400">جارٍ التحقق من الجلسة…</main>;

  return <main dir="rtl" className="mx-auto min-h-screen max-w-6xl px-4 pb-24 pt-6 sm:px-8">
    <header className="flex items-center justify-between border-b border-white/10 pb-5">
      <Link href="/" className="text-3xl font-black tracking-widest text-blue-400">IMI</Link>
      <div className="flex items-center gap-3"><span className="hidden max-w-48 truncate text-sm text-slate-400 sm:inline">{user.email ?? user.uid}</span><NotificationsPanel user={user} /><button onClick={logout} className="rounded-xl border border-white/15 px-4 py-2 text-sm">خروج</button></div>
    </header>
    <section className="py-8"><p className="text-sm text-blue-300">مساحتك الشخصية</p><h1 className="mt-2 text-3xl font-black">أهلاً بك في IMI</h1><p className="mt-2 text-sm text-slate-400">بيانات المحادثات تُقرأ وتُحدّث مباشرة من مشروع Firebase نفسه.</p></section>
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 sm:p-5">
      <div className="flex flex-wrap gap-2">{visibleTabs.map((tab, index) => <button key={tab.label} onClick={() => setActive(index)} aria-pressed={active === index} className={`rounded-xl px-4 py-3 text-sm font-semibold ${active === index ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-300'}`}>{tab.icon} {tab.label}</button>)}</div>
      <div className="mt-5">
        {active === 0 ? <ChatPanel user={user} /> : active === 1 ? <StatusPanel user={user} /> : active === 2 ? <ReelsPanel user={user} /> : active === 4 ? <ProfilePanel user={user} /> : active === 5 ? <FriendsPanel user={user} /> : active === 3 ? <AcademyPanel user={user} /> : active === 6 && isAdmin ? <AcademyAdminPanel user={user} /> : <div className="min-h-48 rounded-2xl bg-white/[.035] p-6"><h2 className="text-xl font-bold">{visibleTabs[active]?.label ?? tabs[0].label}</h2><p className="mt-3 leading-7 text-slate-400">{visibleTabs[active]?.description ?? tabs[0].description}</p><p className="mt-4 text-xs text-slate-500">هذا القسم لم يُربط ببيانات Firebase بعد؛ لا نعرض محتوى تجريبياً على أنه حقيقي.</p></div>}
      </div>
    </section>
    <nav aria-label="التنقل الرئيسي" className="fixed inset-x-0 bottom-0 z-10 border-t border-white/10 bg-slate-950/95 px-2 py-3 backdrop-blur sm:hidden"><div className="mx-auto flex max-w-lg justify-around">{visibleTabs.map((tab, index) => <button key={tab.label} onClick={() => setActive(index)} aria-pressed={active === index} className={`flex flex-col items-center gap-1 text-xs ${active === index ? 'text-blue-300' : 'text-slate-400'}`}><span className="text-lg">{tab.icon}</span>{tab.label}</button>)}</div></nav>
  </main>;
}
