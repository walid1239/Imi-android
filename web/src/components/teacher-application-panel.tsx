'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db, firebaseConfigured } from '@/lib/firebase/client';

type CurriculumNode = { id: string; type: 'level' | 'subject'; nameAr: string; parentId: string | null };

export default function TeacherApplicationPanel() {
  const [nodes, setNodes] = useState<CurriculumNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [levelId, setLevelId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!firebaseConfigured) {
      setLoading(false);
      setError('إعداد Firebase غير مكتمل؛ لا يمكن إرسال الطلب الآن.');
      return;
    }
    return onSnapshot(
      query(collection(db, 'curriculumNodes'), where('status', '==', 'published'),
        where('needsReview', '==', false), where('type', 'in', ['level', 'subject'])),
      snapshot => {
        const rows = snapshot.docs.map(item => ({
          id: item.id,
          type: item.get('type') as 'level' | 'subject',
          nameAr: String(item.get('nameAr') || item.id),
          parentId: typeof item.get('parentId') === 'string' ? item.get('parentId') as string : null,
        }));
        rows.sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar'));
        setNodes(rows); setLoading(false);
      },
      () => { setError('تعذر تحميل المستويات والمواد المنشورة. أعد المحاولة لاحقاً.'); setLoading(false); },
    );
  }, []);

  const levels = useMemo(() => nodes.filter(node => node.type === 'level'), [nodes]);
  const subjects = useMemo(() => nodes.filter(node => node.type === 'subject'), [nodes]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const token = await auth.currentUser?.getIdToken(true);
      if (!token) throw new Error('سجّل الدخول أولاً قبل تقديم طلب التوثيق.');
      const response = await fetch('/api/v1/teachers/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ fullName, proofUrl, levelIds: [levelId], subjectIds: [subjectId] }),
      });
      const json = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !json.ok) throw new Error(json.error || 'تعذر إرسال الطلب. حاول مرة أخرى.');
      setNotice('تم إرسال طلبك بنجاح. سيظهر بعد المراجعة من فريق IMI.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر إرسال الطلب.');
    } finally { setBusy(false); }
  }

  return (
    <main dir="rtl" className="mx-auto min-h-screen max-w-3xl px-4 py-8 text-slate-100">
      <header className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-slate-950 p-6">
        <p className="text-xs font-bold text-violet-300">IMI ACADEMY · TEACHERS</p>
        <h1 className="mt-3 text-2xl font-black">طلب الانضمام كأستاذ</h1>
        <p className="mt-2 text-sm leading-7 text-slate-400">قدّم بياناتك ورابط إثبات آمن عبر HTTPS. لا ترفع ملفات إلى IMI في هذه المرحلة.</p>
      </header>
      <form onSubmit={submit} className="mt-5 space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-5">
        <label className="block space-y-2 text-sm"><span>الاسم الكامل</span>
          <input required minLength={3} maxLength={80} value={fullName} onChange={event => setFullName(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 outline-none focus:border-violet-400" />
        </label>
        <label className="block space-y-2 text-sm"><span>رابط إثبات (HTTPS)</span>
          <input required type="url" maxLength={500} value={proofUrl} onChange={event => setProofUrl(event.target.value)}
            placeholder="https://…" className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 outline-none focus:border-violet-400" />
        </label>
        <label className="block space-y-2 text-sm"><span>المستوى الدراسي</span>
          <select required value={levelId} onChange={event => setLevelId(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3">
            <option value="">اختر المستوى</option>
            {levels.map(node => <option key={node.id} value={node.id}>{node.nameAr}</option>)}
          </select>
        </label>
        <label className="block space-y-2 text-sm"><span>المادة</span>
          <select required value={subjectId} onChange={event => setSubjectId(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3">
            <option value="">اختر المادة</option>
            {subjects.map(node => <option key={node.id} value={node.id}>{node.nameAr}</option>)}
          </select>
        </label>
        {loading && <p className="text-sm text-slate-400">جارٍ تحميل الاختيارات المنشورة…</p>}
        {!loading && (!levels.length || !subjects.length) && <p className="text-sm text-amber-200">لا توجد مستويات ومواد منشورة متاحة حالياً.</p>}
        {error && <p role="alert" className="rounded-xl border border-red-400/30 p-3 text-sm text-red-200">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-emerald-400/30 p-3 text-sm text-emerald-200">{notice}</p>}
        <button type="submit" disabled={busy || loading || !levels.length || !subjects.length}
          className="w-full rounded-xl bg-violet-600 px-4 py-3 font-bold disabled:opacity-40">
          {busy ? 'جارٍ الإرسال…' : 'إرسال طلب التوثيق'}
        </button>
      </form>
    </main>
  );
}
