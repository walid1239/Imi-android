'use client';

import { FormEvent, useState } from 'react';
import { GoogleAuthProvider, createUserWithEmailAndPassword, sendPasswordResetEmail, signInAnonymously, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth, firebaseConfigured } from '@/lib/firebase/client';


function getArabicAuthError(error: unknown, action: 'email' | 'google' | 'guest' | 'reset'): string {
  const code = error instanceof FirebaseError ? error.code : '';
  if (code === 'auth/configuration-not-found' || (error instanceof Error && error.message.includes('CONFIGURATION_NOT_FOUND'))) {
    return 'خدمة تسجيل الدخول في Firebase غير مكتملة الإعداد. راجع لوحة Firebase: Authentication ← Sign-in method، وفعّل طريقة الدخول التي تستخدمها، ثم تحقق من إعداد تطبيق الويب ومفتاح API والنطاقات المسموح بها.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'طريقة تسجيل الدخول هذه غير مفعّلة في Firebase. افتح Authentication ← Sign-in method وفعّلها لهذا المشروع.';
  }
  if (code === 'auth/invalid-api-key' || code === 'auth/app-not-authorized') {
    return 'إعداد تطبيق IMI لا يطابق مشروع Firebase أو أن مفتاح API غير صالح. تحقق من Project settings ← Your apps ومن متغيرات NEXT_PUBLIC_FIREBASE_* دون مشاركة أي مفاتيح خاصة.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'عنوان الموقع غير مسموح له باستخدام Firebase Authentication. أضف نطاق الموقع الفعلي إلى Authentication ← Settings ← Authorized domains.';
  }
  if (code === 'auth/network-request-failed') return 'تعذر الاتصال بخدمة Firebase. تحقق من الإنترنت أو إعدادات الشبكة ثم حاول مجدداً.';
  if (code === 'auth/too-many-requests') return 'تم إيقاف المحاولات مؤقتاً لكثرتها. انتظر قليلاً ثم حاول مجدداً.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'بيانات الدخول غير صحيحة أو لا يوجد حساب بهذه البيانات.';
  if (code === 'auth/email-already-in-use') return 'هذا البريد مرتبط بحساب موجود. جرّب تسجيل الدخول بدلاً من إنشاء حساب جديد.';
  if (code === 'auth/weak-password') return 'كلمة المرور ضعيفة. استخدم ستة أحرف على الأقل.';
  if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user') return 'لم تكتمل نافذة تسجيل الدخول بواسطة Google. اسمح بالنوافذ المنبثقة ثم حاول مجدداً.';
  if (code === 'auth/admin-restricted-operation') return 'تسجيل الدخول كضيف غير مفعّل في Firebase. فعّل Anonymous من Authentication ← Sign-in method.';
  if (action === 'reset') return 'تعذر إرسال رابط استعادة كلمة المرور. تحقق من إعداد Email/Password والبريد ثم حاول مجدداً.';
  if (action === 'google') return 'تعذر تسجيل الدخول بواسطة Google. تحقق من تفعيل Google وإعداد النطاقات المسموح بها في Firebase.';
  if (action === 'guest') return 'تعذر إنشاء جلسة ضيف. تحقق من تفعيل Anonymous في Firebase Authentication.';
  return 'تعذر إكمال تسجيل الدخول. تحقق من إعداد Firebase ثم أعد المحاولة.';
}

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
      setMessage(getArabicAuthError(error, 'email'));
    } finally { setBusy(false); }
  }

  async function googleLogin() {
    setMessage('');
    if (!firebaseConfigured) { setMessage('إعداد Firebase غير مكتمل.'); return; }
    setBusy(true);
    try { await signInWithPopup(auth, new GoogleAuthProvider()); router.replace('/app'); }
    catch (error) { setMessage(getArabicAuthError(error, 'google')); }
    finally { setBusy(false); }
  }

  async function continueAsGuest() {
    setMessage('');
    if (!firebaseConfigured) { setMessage('إعداد Firebase غير مكتمل.'); return; }
    setBusy(true);
    try {
      await signInAnonymously(auth);
      router.replace('/app');
    } catch (error) {
      setMessage(getArabicAuthError(error, 'guest'));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) { setMessage('أدخل بريدك الإلكتروني أولاً.'); return; }
    if (!firebaseConfigured) { setMessage('إعداد Firebase غير مكتمل.'); return; }
    try { await sendPasswordResetEmail(auth, email.trim()); setMessage('إذا كان البريد مسجلاً، فستصلك رسالة إعادة تعيين كلمة المرور.'); }
    catch (error) { setMessage(getArabicAuthError(error, 'reset')); }
  }

  return <main className="grid min-h-screen place-items-center px-5 py-10"><section className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-7 shadow-2xl"><Link href="/" className="text-3xl font-black tracking-widest text-blue-400">IMI</Link><h1 className="mt-7 text-2xl font-bold">{mode === 'login' ? 'مرحباً بعودتك' : 'إنشاء حساب IMI'}</h1><p className="mt-2 text-sm leading-7 text-slate-400">سجّل الدخول لمتابعة محادثاتك ومحتواك.</p><form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-sm">البريد الإلكتروني<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-blue-500" /></label><label className="block text-sm">كلمة المرور<input required minLength={6} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-blue-500" /></label><button disabled={busy} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold disabled:opacity-50">{busy ? 'جارٍ التنفيذ…' : mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}</button></form><button onClick={googleLogin} disabled={busy} className="mt-3 w-full rounded-xl border border-white/15 px-4 py-3 font-semibold hover:bg-white/5 disabled:opacity-50">المتابعة باستخدام Google</button>\n<button onClick={continueAsGuest} disabled={busy} className="mt-3 w-full rounded-xl border border-blue-500/30 px-4 py-3 text-sm font-semibold text-blue-200 hover:bg-blue-500/10 disabled:opacity-50">الدخول السريع كضيف</button><button onClick={resetPassword} className="mt-4 block w-full text-center text-sm text-blue-300">نسيت كلمة المرور؟</button><button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage(''); }} className="mt-5 w-full text-sm text-slate-300">{mode === 'login' ? 'ليس لديك حساب؟ إنشاء حساب' : 'لديك حساب بالفعل؟ تسجيل الدخول'}</button>{message && <p role="status" className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm leading-6 text-amber-200">{message}</p>}{!firebaseConfigured && <p className="mt-4 text-xs leading-6 text-slate-500">هذه النسخة تحتاج إعداد متغيرات Firebase العامة قبل الاتصال بالخدمة.</p>}</section></main>;
}
