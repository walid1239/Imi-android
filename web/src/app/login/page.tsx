'use client';

import { FormEvent, useState } from 'react';
import { GoogleAuthProvider, createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth, firebaseConfigured } from '@/lib/firebase/client';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!firebaseConfigured) { setMessage('إعداد Firebase غير مكتمل. يجب ضبط متغيرات البيئة قبل تسجيل الدخول.'); return; }
    setBusy(true);
    try {
      if (mode === 'login') await signInWithEmailAndPassword(auth, email.trim(), password);
      else await createUserWithEmailAndPassword(auth, email.trim(), password);
      router.replace('/app');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر إكمال العملية.');
    } finally { setBusy(false); }
  }

  async function googleLogin() {
    setMessage('');
    if (!firebaseConfigured) { setMessage('إعداد Firebase غير مكتمل.'); return; }
    setBusy(true);
    try { await signInWithPopup(auth, new GoogleAuthProvider()); router.replace('/app'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر تسجيل الدخول بواسطة Google.'); }
    finally { setBusy(false); }
  }

  async function resetPassword() {
    if (!email.trim()) { setMessage('أدخل بريدك الإلكتروني أولاً.'); return; }
    if (!firebaseConfigured) { setMessage('إعداد Firebase غير مكتمل.'); return; }
    try { await sendPasswordResetEmail(auth, email.trim()); setMessage('إذا كان البريد مسجلاً، فستصلك رسالة إعادة تعيين كلمة المرور.'); }
    catch { setMessage('تعذر إرسال رسالة إعادة التعيين. تحقق من البريد وحاول مجدداً.'); }
  }

  return <main className="grid min-h-screen place-items-center px-5 py-10"><section className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-7 shadow-2xl"><Link href="/" className="text-3xl font-black tracking-widest text-blue-400">IMI</Link><h1 className="mt-7 text-2xl font-bold">{mode === 'login' ? 'مرحباً بعودتك' : 'إنشاء حساب IMI'}</h1><p className="mt-2 text-sm leading-7 text-slate-400">سجّل الدخول لمتابعة محادثاتك ومحتواك.</p><form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-sm">البريد الإلكتروني<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-blue-500" /></label><label className="block text-sm">كلمة المرور<input required minLength={6} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-blue-500" /></label><button disabled={busy} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold disabled:opacity-50">{busy ? 'جارٍ التنفيذ…' : mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}</button></form><button onClick={googleLogin} disabled={busy} className="mt-3 w-full rounded-xl border border-white/15 px-4 py-3 font-semibold hover:bg-white/5 disabled:opacity-50">المتابعة باستخدام Google</button><button onClick={resetPassword} className="mt-4 block w-full text-center text-sm text-blue-300">نسيت كلمة المرور؟</button><button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage(''); }} className="mt-5 w-full text-sm text-slate-300">{mode === 'login' ? 'ليس لديك حساب؟ إنشاء حساب' : 'لديك حساب بالفعل؟ تسجيل الدخول'}</button>{message && <p role="status" className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm leading-6 text-amber-200">{message}</p>}{!firebaseConfigured && <p className="mt-4 text-xs leading-6 text-slate-500">هذه النسخة تحتاج إعداد متغيرات Firebase العامة قبل الاتصال بالخدمة.</p>}</section></main>;
}
