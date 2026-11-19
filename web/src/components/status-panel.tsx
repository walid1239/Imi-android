'use client';

import { FormEvent, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, storage } from '@/lib/firebase/client';

type Status = {
  id: string;
  text: string;
  mediaPath?: string;
  expiresAt: Timestamp;
};

type CreateStatusResult = {
  statusId: string;
  expiresAtMillis: number;
  mediaPath: string | null;
};

export default function StatusPanel({ user }: { user: User }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const statuses = collection(db, 'users', user.uid, 'statuses');
    const activeStatuses = query(
      statuses,
      where('expiresAt', '>', Timestamp.now()),
      orderBy('expiresAt', 'desc')
    );
    return onSnapshot(activeStatuses, snapshot => {
      const item = snapshot.docs[0];
      if (!item) { setStatus(null); setMediaUrl(''); return; }
      const expiresAt = item.get('expiresAt');
      const mediaPath = item.get('mediaPath');
      setStatus({
        id: item.id,
        text: item.get('text') || '',
        mediaPath: typeof mediaPath === 'string' ? mediaPath : undefined,
        expiresAt
      });
      setMediaUrl('');
      if (typeof mediaPath === 'string') {
        getDownloadURL(ref(storage, mediaPath))
          .then(setMediaUrl)
          .catch(reason => setError(reason instanceof Error ? reason.message : 'تعذر تحميل صورة الحالة.'));
      }
      setError('');
    }, reason => setError(reason.message));
  }, [user.uid]);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    if (!value && !file) { setError('أضف نصاً أو صورة قبل النشر.'); return; }
    if (value.length > 700) { setError('نص الحالة يتجاوز 700 حرف.'); return; }
    if (file && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('الصور المدعومة JPEG وPNG وWebP فقط.'); return;
    }
    if (file && file.size > 20 * 1024 * 1024) {
      setError('حجم الصورة يتجاوز الحد الأقصى 20 ميغابايت.'); return;
    }
    setBusy(true); setError(''); setNotice('');
    let created: CreateStatusResult | null = null;
    try {
      const callable = httpsCallable<{ text?: string; mediaType?: string }, CreateStatusResult>(
        getFunctions(), 'createStatus'
      );
      const payload: { text?: string; mediaType?: string } = {};
      if (value) payload.text = value;
      if (file) payload.mediaType = file.type;
      const response = await callable(payload);
      created = response.data;
      if (!created.statusId || !created.expiresAtMillis) throw new Error('استجابة خادم الحالات غير مكتملة.');
      if (file) {
        if (!created.mediaPath) throw new Error('لم يرجع الخادم مسار صورة الحالة.');
        await uploadBytes(ref(storage, created.mediaPath), file, { contentType: file.type });
      }
      setText(''); setFile(null);
      const input = document.getElementById('imi-status-file') as HTMLInputElement | null;
      if (input) input.value = '';
      setNotice('نُشرت حالتك. ستنتهي بعد 28 ساعة محسوبة من وقت الخادم.');
    } catch (reason) {
      if (created?.statusId) {
        await deleteDoc(doc(db, 'users', user.uid, 'statuses', created.statusId)).catch(() => undefined);
        if (created.mediaPath) await import('firebase/storage').then(({ deleteObject }) => deleteObject(ref(storage, created!.mediaPath!))).catch(() => undefined);
      }
      setError(reason instanceof Error ? reason.message : 'تعذر نشر الحالة.');
    } finally {
      setBusy(false);
    }
  }

  async function removeStatus() {
    if (!status || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'statuses', status.id));
      if (status.mediaPath) {
        const { deleteObject } = await import('firebase/storage');
        await deleteObject(ref(storage, status.mediaPath)).catch(() => undefined);
      }
      setNotice('حُذفت حالتك.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر حذف الحالة.');
    } finally {
      setBusy(false);
    }
  }

  return <section dir="rtl" className="space-y-5">
    <form onSubmit={publish} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <h3 className="font-bold">أضف حالة جديدة</h3>
      <p className="mt-1 text-xs leading-6 text-slate-400">إنشاء الحالة يتم عبر createStatus على الخادم، ومدة الصلاحية 28 ساعة من توقيت الخادم.</p>
      <textarea value={text} onChange={event => setText(event.target.value)} maxLength={700} rows={3} placeholder="ماذا تريد أن تشارك؟" disabled={busy} className="mt-4 w-full resize-y rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-blue-500" />
      <input id="imi-status-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setFile(event.target.files?.[0] ?? null)} disabled={busy} className="mt-3 block w-full text-sm text-slate-300 file:ml-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-slate-100" />
      <button disabled={busy || (!text.trim() && !file)} className="mt-3 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold disabled:opacity-40">{busy ? 'جارٍ النشر…' : 'نشر الحالة'}</button>
    </form>
    {error && <p role="alert" className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-6 text-amber-200">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs leading-6 text-emerald-200">{notice}</p>}
    {status ? <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-3"><h3 className="font-bold">حالتي الحالية</h3><span className="text-xs text-slate-400">تنتهي: {new Intl.DateTimeFormat('ar', { dateStyle: 'short', timeStyle: 'short' }).format(status.expiresAt.toDate())}</span></div>
      {status.text && <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{status.text}</p>}
      {status.mediaPath && (mediaUrl ? <img src={mediaUrl} alt="صورة الحالة" className="mt-4 max-h-[520px] w-full rounded-xl object-contain" /> : <p className="mt-3 text-xs text-slate-400">جارٍ تحميل صورة الحالة…</p>)}
      <button onClick={removeStatus} disabled={busy} className="mt-4 rounded-lg border border-rose-500/30 px-4 py-2 text-xs font-semibold text-rose-300 disabled:opacity-40">حذف حالتي</button>
    </article> : <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">لا توجد حالة نشطة لك حالياً.</p>}
    <p className="text-xs leading-6 text-slate-500">ملاحظة: هذه المرحلة تعرض حالتك أنت فقط. حالات الأصدقاء تحتاج استعلاماً آمناً لعلاقات الصداقة الموثقة، ولن نفتح قراءة الحالات للجميع.</p>
  </section>;
}
