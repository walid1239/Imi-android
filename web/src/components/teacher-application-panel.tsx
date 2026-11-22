'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

export default function TeacherApplicationPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [subjectIds, setSubjectIds] = useState('');
  const [levelIds, setLevelIds] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      setMessage('سجّل الدخول أولاً لإرسال طلب التوثيق.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/v1/teachers/applications', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName,
          proofUrl,
          subjectIds: subjectIds.split(',').map(value => value.trim()).filter(Boolean),
          levelIds: levelIds.split(',').map(value => value.trim()).filter(Boolean),
        }),
      });
      const payload = await response.json() as { data?: { status?: string }; error?: string };
      if (!response.ok) throw new Error(payload.error || 'تعذر إرسال طلب التوثيق.');
      setMessage(payload.data?.status === 'pending'
        ? 'تم إرسال طلبك بنجاح. سيُراجع المشرف رابط الإثبات يدوياً.'
        : 'تم استلام الطلب.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر إرسال الطلب حالياً.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main dir="rtl" className="mx-auto min-h-screen max-w-3xl px-4 py-8 text-slate-100">
      <header className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-slate-950 p-6">
        <p className="text-xs font-bold text-violet-300">IMI ACADEMY · TEACHERS</p>
        <h1 className="mt-3 text-2xl font-black">طلب الانضمام كأستاذ</h1>
        <p className="mt-2 text-sm leading-7 text-slate-400">
          أرسل رابطاً آمناً لإثبات الصفة المهنية. لا ترفع ملفات إلى IMI؛ يراجع المشرف الرابط يدوياً.
        </p>
      </header>

      <form onSubmit={submit} className="mt-5 space-y-4 rounded-2xl border border-white/10 bg-slate-950/70 p-5">
        <label className="block space-y-2">
          <span className="text-sm font-bold">الاسم الكامل</span>
          <input required minLength={3} maxLength={80} value={fullName}
            onChange={event => setFullName(event.target.value)}
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-violet-400"
            autoComplete="name" />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-bold">رابط إثبات الصفة المهنية (HTTPS)</span>
          <input required type="url" value={proofUrl} onChange={event => setProofUrl(event.target.value)}
            placeholder="https://drive.google.com/..."
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-4 py-3 text-left text-sm outline-none focus:border-violet-400"
            dir="ltr" />
          <span className="block text-xs leading-6 text-slate-400">
            اجعل الرابط قابلاً للعرض من طرف المشرف فقط، ولا ترسل كلمات مرور أو روابط تحتوي بيانات دخول.
          </span>
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-bold">معرّفات المواد المنشورة</span>
          <input required value={subjectIds} onChange={event => setSubjectIds(event.target.value)}
            placeholder="subject-math, subject-arabic"
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-4 py-3 text-left text-sm outline-none focus:border-violet-400"
            dir="ltr" />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-bold">معرّفات المستويات المنشورة</span>
          <input required value={levelIds} onChange={event => setLevelIds(event.target.value)}
            placeholder="level-primary, level-middle"
            className="w-full rounded-xl border border-white/15 bg-slate-900 px-4 py-3 text-left text-sm outline-none focus:border-violet-400"
            dir="ltr" />
        </label>
        <button type="submit" disabled={!user || busy}
          className="w-full rounded-xl bg-violet-600 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? 'جارٍ إرسال الطلب…' : 'إرسال طلب التوثيق'}
        </button>
        {!user && <p className="text-sm text-amber-300">سجّل الدخول قبل التقديم.</p>}
        {message && <p role="status" className="text-sm leading-6 text-slate-200">{message}</p>}
      </form>
    </main>
  );
}
