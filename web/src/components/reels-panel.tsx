'use client';

import { FormEvent, useEffect, useState } from 'react';
import { getIdTokenResult, User } from 'firebase/auth';
import { collection, doc, limit, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, functions, storage } from '@/lib/firebase/client';

type Reel = { id: string; ownerUid: string; caption: string; videoUrl: string; createdAt: Timestamp | null };

function dateLabel(value: Timestamp | null) {
  return value ? new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(value.toDate()) : '';
}

export default function ReelsPanel({ user }: { user: User }) {
  const [reels, setReels] = useState<Reel[]>([]);
  const [pendingReels, setPendingReels] = useState<Reel[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void getIdTokenResult(user).then(token => {
      if (active) setIsAdmin(token.claims.admin === true);
    }).catch(() => {
      if (active) setIsAdmin(false);
    });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!isAdmin) {
      setPendingReels([]);
      return;
    }
    const q = query(collection(db, 'reels'), where('status', '==', 'pending'), limit(50));
    return onSnapshot(q, snapshot => {
      void Promise.all(snapshot.docs.map(async item => {
        const ownerUid = item.get('ownerUid');
        const storagePath = item.get('storagePath');
        if (typeof ownerUid !== 'string' || typeof storagePath !== 'string') return null;
        try {
          const videoUrl = await getDownloadURL(ref(storage, storagePath));
          return { id: item.id, ownerUid, videoUrl, caption: item.get('caption') || '', createdAt: item.get('createdAt') || null };
        } catch {
          return null;
        }
      })).then(items => setPendingReels(items.filter((item): item is Reel => item !== null)));
    }, reason => setError(reason.message));
  }, [isAdmin]);

  useEffect(() => {
    const q = query(collection(db, 'reels'), where('status', '==', 'approved'), limit(50));
    return onSnapshot(q, snapshot => {
      void Promise.all(snapshot.docs.map(async item => {
        const ownerUid = item.get('ownerUid');
        const storagePath = item.get('storagePath');
        if (typeof ownerUid !== 'string' || typeof storagePath !== 'string') return null;
        try {
          const videoUrl = await getDownloadURL(ref(storage, storagePath));
          return { id: item.id, ownerUid, videoUrl, caption: item.get('caption') || '', createdAt: item.get('createdAt') || null };
        } catch {
          return null;
        }
      })).then(items => setReels(items.filter((item): item is Reel => item !== null).sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))));
      setError('');
    }, reason => setError(reason.message));
  }, []);

  async function reviewReel(reelId: string, decision: 'approved' | 'rejected') {
    if (!isAdmin || reviewingId) return;
    setReviewingId(reelId); setError('');
    try {
      await httpsCallable(functions, 'reviewReel')({ reelId, decision });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذرت مراجعة المقطع.');
    } finally {
      setReviewingId(null);
    }
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || busy) return;
    if (!['video/mp4', 'video/webm'].includes(file.type)) { setError('الصيغ المدعومة حالياً MP4 وWebM فقط.'); return; }
    if (file.size > 100 * 1024 * 1024) { setError('حجم الفيديو يتجاوز الحد الأقصى 100 ميغابايت.'); return; }
    setBusy(true); setProgress(0); setError('');
    try {
      const id = doc(collection(db, 'reels')).id;
      const extension = file.type === 'video/webm' ? 'webm' : 'mp4';
      const path = `reels/${user.uid}/${id}/video.${extension}`;
      const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type });
      await new Promise<void>((resolve, reject) => {
        task.on('state_changed',
          snapshot => setProgress(Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100)),
          reject,
          () => resolve()
        );
      });
      const submit = httpsCallable(functions, 'submitReel');
      await submit({
        reelId: id,
        caption: caption.trim().slice(0, 300),
        storagePath: path,
        contentType: file.type
      });
      setCaption(''); setFile(null); setProgress(100);
      setError('تم استلام المقطع للمراجعة. لن يظهر للآخرين إلا بعد الموافقة.');
      const input = document.getElementById('imi-reel-file') as HTMLInputElement | null;
      if (input) input.value = '';
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر رفع الفيديو ونشره.');
    } finally {
      setBusy(false);
    }
  }

  return <section dir="rtl" className="space-y-5">
    <form onSubmit={publish} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <h3 className="font-bold">انشر مقطعاً حقيقياً</h3>
      <p className="mt-1 text-xs leading-6 text-slate-400">يُرفع الفيديو بشكل خاص، ثم يُرسل للمراجعة. لا يظهر للمستخدمين الآخرين إلا بعد موافقة المشرف.</p>
      <input id="imi-reel-file" type="file" accept="video/mp4,video/webm" onChange={event => setFile(event.target.files?.[0] ?? null)} disabled={busy} className="mt-4 block w-full text-sm text-slate-300 file:ml-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-slate-100" />
      <input value={caption} onChange={event => setCaption(event.target.value)} maxLength={300} placeholder="اكتب وصفاً للمقطع (اختياري)" disabled={busy} className="mt-3 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-blue-500" />
      <button disabled={!file || busy} className="mt-3 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold disabled:opacity-40">{busy ? `جارٍ الرفع ${progress}%` : 'رفع وإرسال للمراجعة'}</button>
      {busy && <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} /></div>}
    </form>
    {isAdmin && <section className="space-y-3 rounded-2xl border border-amber-400/20 bg-amber-950/20 p-4">
      <h3 className="font-bold">مراجعة المقاطع المعلّقة ({pendingReels.length})</h3>
      {pendingReels.length === 0 ? <p className="text-xs text-slate-400">لا توجد مقاطع تنتظر المراجعة.</p> :
        <div className="grid gap-4 sm:grid-cols-2">{pendingReels.map(reel => <article key={reel.id} className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/70">
          <video controls playsInline preload="metadata" src={reel.videoUrl} className="aspect-[9/16] max-h-[360px] w-full bg-black object-contain" />
          <div className="space-y-3 p-3">
            <p className="text-sm">{reel.caption || 'بدون وصف'}</p>
            <p className="text-[10px] text-slate-500">صاحب المقطع: {reel.ownerUid}</p>
            <div className="flex gap-2">
              <button type="button" disabled={reviewingId !== null} onClick={() => void reviewReel(reel.id, 'approved')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold disabled:opacity-40">{reviewingId === reel.id ? 'جارٍ الحفظ…' : 'موافقة'}</button>
              <button type="button" disabled={reviewingId !== null} onClick={() => void reviewReel(reel.id, 'rejected')} className="rounded-lg bg-rose-900 px-3 py-2 text-xs font-bold disabled:opacity-40">رفض</button>
            </div>
          </div>
        </article>)}</div>}
    </section>}
    {error && <p role="alert" className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-6 text-amber-200">{error}</p>}
    {reels.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">لا توجد مقاطع منشورة في السحابة حالياً.</p> :
      <div className="grid gap-4 sm:grid-cols-2">{reels.map(reel => <article key={reel.id} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
        <video controls playsInline preload="metadata" src={reel.videoUrl} className="aspect-[9/16] max-h-[520px] w-full bg-black object-contain" />
        <div className="p-4"><p className="whitespace-pre-wrap text-sm">{reel.caption || 'بدون وصف'}</p><p className="mt-2 text-[10px] text-slate-500">{reel.ownerUid === user.uid ? 'منشورك' : `مستخدم ${reel.ownerUid.slice(0, 8)}`} · {dateLabel(reel.createdAt)}</p></div>
      </article>)}</div>}
  </section>;
}
