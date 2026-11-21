'use client';

import { FormEvent, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/client';
import { postAuthenticated } from '@/lib/api';

type Status = {
  id: string;
  text: string;
  mediaPath?: string;
  expiresAt: Timestamp;
};

type FriendStatus = { id: string; ownerUid: string; displayName: string; text: string; expiresAt: Timestamp; mediaUrl?: string };

type CreateStatusResult = {
  statusId: string;
  expiresAtMillis: number;
};

export default function StatusPanel({ user }: { user: User }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [friendStatuses, setFriendStatuses] = useState<FriendStatus[]>([]);
  const [mediaUrl, setMediaUrl] = useState('');
  const [text, setText] = useState('');
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

  useEffect(() => {
    let statusUnsubs: Array<() => void> = [];
    const stopFriends = onSnapshot(collection(db, 'users', user.uid, 'friends'), snapshot => {
      statusUnsubs.forEach(stop => stop());
      statusUnsubs = [];
      const friendIds = snapshot.docs
        .filter(item => item.get('status') === 'accepted')
        .map(item => item.id);
      setFriendStatuses(current => current.filter(item => friendIds.includes(item.ownerUid)));
      if (friendIds.length === 0) setFriendStatuses([]);

      friendIds.forEach(friendUid => {
        const activeQuery = query(
          collection(db, 'users', friendUid, 'statuses'),
          where('expiresAt', '>', Timestamp.now()),
          orderBy('expiresAt', 'desc')
        );
        const stop = onSnapshot(activeQuery, async statusesSnapshot => {
          const profileSnapshot = await getDoc(doc(db, 'publicProfiles', friendUid));
          const displayName = profileSnapshot.exists()
            ? profileSnapshot.get('displayName') || 'صديق'
            : 'صديق';
          const items = await Promise.all(statusesSnapshot.docs.map(async item => {
            const mediaPath = item.get('mediaPath');
            let mediaUrl = '';
            if (typeof mediaPath === 'string') {
              try { mediaUrl = await getDownloadURL(ref(storage, mediaPath)); } catch { mediaUrl = ''; }
            }
            return {
              id: item.id,
              ownerUid: friendUid,
              displayName,
              text: item.get('text') || '',
              expiresAt: item.get('expiresAt') as Timestamp,
              ...(mediaUrl ? { mediaUrl } : {}),
            };
          }));
          setFriendStatuses(current => [
            ...current.filter(item => item.ownerUid !== friendUid),
            ...items,
          ]);
        }, reason => setError(reason.message));
        statusUnsubs.push(stop);
      });
    }, reason => setError(reason.message));
    return () => {
      stopFriends();
      statusUnsubs.forEach(stop => stop());
    };
  }, [user.uid]);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    if (!value) { setError('اكتب نص الحالة قبل النشر.'); return; }
    if (value.length > 700) { setError('نص الحالة يتجاوز 700 حرف.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const created = await postAuthenticated<CreateStatusResult>(user, '/api/v1/status', { text: value });
      if (!created.statusId || !created.expiresAtMillis) throw new Error('استجابة خادم الحالات غير مكتملة.');
      setText('');
      setNotice('نُشرت حالتك. ستنتهي بعد 28 ساعة محسوبة من وقت الخادم.');
    } catch (reason) {
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
      <p className="mt-1 text-xs leading-6 text-slate-400">تُنشر الحالات النصية عبر خادم IMI وتبقى 28 ساعة. رفع الصور غير متاح في مرحلة Firebase Spark المجانية.</p>
      <textarea value={text} onChange={event => setText(event.target.value)} maxLength={700} rows={3} placeholder="ماذا تريد أن تشارك؟" disabled={busy} className="mt-4 w-full resize-y rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-blue-500" />
      <button disabled={busy || !text.trim()} className="mt-3 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold disabled:opacity-40">{busy ? 'جارٍ النشر…' : 'نشر الحالة'}</button>
    </form>
    {error && <p role="alert" className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-6 text-amber-200">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs leading-6 text-emerald-200">{notice}</p>}
    {status ? <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-3"><h3 className="font-bold">حالتي الحالية</h3><span className="text-xs text-slate-400">تنتهي: {new Intl.DateTimeFormat('ar', { dateStyle: 'short', timeStyle: 'short' }).format(status.expiresAt.toDate())}</span></div>
      {status.text && <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{status.text}</p>}
      {status.mediaPath && (mediaUrl ? <img src={mediaUrl} alt="صورة الحالة" className="mt-4 max-h-[520px] w-full rounded-xl object-contain" /> : <p className="mt-3 text-xs text-slate-400">جارٍ تحميل صورة الحالة…</p>)}
      <button onClick={removeStatus} disabled={busy} className="mt-4 rounded-lg border border-rose-500/30 px-4 py-2 text-xs font-semibold text-rose-300 disabled:opacity-40">حذف حالتي</button>
    </article> : <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">لا توجد حالة نشطة لك حالياً.</p>}
    <section className="space-y-3">
      <div className="flex items-center justify-between"><h3 className="font-bold">حالات أصدقائك</h3><span className="text-xs text-slate-500">{friendStatuses.length}</span></div>
      {friendStatuses.length === 0
        ? <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-500">لا توجد حالات نشطة من أصدقائك حالياً.</p>
        : friendStatuses.map(item => <article key={item.ownerUid + item.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between gap-3"><h4 className="font-semibold">{item.displayName}</h4><span className="text-xs text-slate-500">تنتهي {new Intl.DateTimeFormat('ar', { dateStyle: 'short', timeStyle: 'short' }).format(item.expiresAt.toDate())}</span></div>
          {item.text && <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{item.text}</p>}
          {item.mediaUrl && <img src={item.mediaUrl} alt="حالة صديق" className="mt-3 max-h-[520px] w-full rounded-xl object-contain" />}
        </article>)}
    </section>
    <p className="text-xs leading-6 text-slate-500">تُعرض حالات الأصدقاء فقط عندما تكون علاقة الصداقة مؤكدة من الطرفين، وتظل صلاحية الحالة محسوبة من توقيت الخادم. الوسائط مؤجلة إلى مرحلة تتوفر فيها خدمة تخزين مجانية مناسبة.</p>
  </section>;
}
