'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db, firebaseConfigured } from '@/lib/firebase/client';

type CurriculumNode = {
  id: string;
  parentId: string | null;
  type: string;
  nameAr: string;
  nameFr: string;
  order: number;
};

function isDescendantOf(node: CurriculumNode, ancestorId: string, byId: Map<string, CurriculumNode>): boolean {
  let parentId = node.parentId;
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    if (parentId === ancestorId) return true;
    visited.add(parentId);
    parentId = byId.get(parentId)?.parentId ?? null;
  }
  return false;
}

export default function TeacherApplicationPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [nodes, setNodes] = useState<CurriculumNode[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [fullName, setFullName] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async current => {
      if (!active) return;
      setUser(current);
      if (!current) {
        setNodes([]);
        setLoading(false);
        return;
      }
      if (!firebaseConfigured) {
        setLoading(false);
        setError('إعداد Firebase غير مكتمل؛ لا يمكن تحميل المنهاج المنشور.');
        return;
      }
      setLoading(true);
      try {
        const published = query(
          collection(db, 'curriculumNodes'),
          where('status', '==', 'published'),
          where('needsReview', '==', false),
          where('type', 'in', ['level', 'track', 'subject', 'unit']),
        );
        const snapshot = await getDocs(published);
        if (!active) return;
        const items = snapshot.docs.map(item => ({
          id: item.id,
          parentId: typeof item.get('parentId') === 'string' ? item.get('parentId') as string : null,
          type: String(item.get('type') ?? ''),
          nameAr: String(item.get('nameAr') ?? ''),
          nameFr: String(item.get('nameFr') ?? ''),
          order: typeof item.get('order') === 'number' ? item.get('order') as number : 0,
        })).filter(item => ['level', 'track', 'subject', 'unit'].includes(item.type));
        setNodes(items);
        setError('');
      } catch {
        if (active) setError('تعذّر تحميل المستويات والمواد المنشورة. حاول تحديث الصفحة.');
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const levels = useMemo(
    () => nodes.filter(node => node.type === 'level').sort((a, b) => a.order - b.order || a.nameAr.localeCompare(b.nameAr)),
    [nodes],
  );
  const byId = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);
  const subjects = useMemo(
    () => nodes.filter(node => node.type === 'subject' && selectedLevelId && isDescendantOf(node, selectedLevelId, byId))
      .sort((a, b) => a.order - b.order || a.nameAr.localeCompare(b.nameAr)),
    [nodes, selectedLevelId, byId],
  );

  function toggleSubject(id: string, checked: boolean) {
    setSelectedSubjectIds(current => checked
      ? (current.includes(id) ? current : [...current, id])
      : current.filter(item => item !== id));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!user) {
      setError('سجّل الدخول أولاً لإرسال طلبك.');
      return;
    }
    if (!/^https:\/\//i.test(proofUrl.trim())) {
      setError('يجب أن يكون رابط الإثبات آمناً ويبدأ بـ https://.');
      return;
    }
    if (!selectedLevelId || selectedSubjectIds.length === 0) {
      setError('اختر مستوى منشوراً ومادة واحدة على الأقل.');
      return;
    }
    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/v1/teachers/applications', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          proofUrl: proofUrl.trim(),
          levelIds: [selectedLevelId],
          subjectIds: selectedSubjectIds,
        }),
      });
      const payload = await response.json() as { ok?: boolean; data?: { status?: string }; error?: string };
      if (!response.ok || payload.ok !== true || payload.data?.status !== 'pending') {
        throw new Error(payload.error || 'تعذّر إرسال الطلب. حاول لاحقاً.');
      }
      setNotice('تم إرسال طلبك بنجاح. سيظهر للمراجعة الإدارية بعد التحقق من البيانات.');
      setFullName('');
      setProofUrl('');
      setSelectedSubjectIds([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذّر إرسال الطلب.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main dir="rtl" className="mx-auto min-h-screen max-w-3xl px-4 py-8 text-slate-100">
      <header className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-slate-950 p-6">
        <p className="text-xs font-bold text-violet-300">IMI ACADEMY · TEACHERS</p>
        <h1 className="mt-3 text-2xl font-black">طلب الانضمام كأستاذ</h1>
        <p className="mt-2 text-sm leading-7 text-slate-400">
          أرسل بياناتك ورابط إثبات آمن. لا نرفع ملفات ولا نخزن وثائق شخصية في هذه المرحلة.
        </p>
      </header>

      {!user ? (
        <section className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-sm leading-7">
          <p>يجب تسجيل الدخول قبل إرسال طلب الانضمام.</p>
          <Link href="/login" className="mt-3 inline-flex rounded-xl bg-blue-600 px-4 py-2 font-bold">تسجيل الدخول</Link>
        </section>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-5 rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <label className="block text-sm font-semibold">
            الاسم الكامل
            <input
              required minLength={3} maxLength={80} value={fullName}
              onChange={event => setFullName(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-violet-400"
              autoComplete="name"
            />
          </label>

          <label className="block text-sm font-semibold">
            رابط إثبات الخبرة (HTTPS)
            <input
              required type="url" maxLength={500} value={proofUrl}
              onChange={event => setProofUrl(event.target.value)}
              placeholder="https://example.com/..."
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-left outline-none focus:border-violet-400"
              dir="ltr"
            />
            <span className="mt-1 block text-xs font-normal text-slate-400">تأكد أن فريق المراجعة يستطيع فتح الرابط. لا ترسل كلمات مرور أو روابط تتطلب مشاركة بيانات الدخول.</span>
          </label>

          <label className="block text-sm font-semibold">
            المستوى الدراسي المنشور
            <select
              required value={selectedLevelId}
              onChange={event => { setSelectedLevelId(event.target.value); setSelectedSubjectIds([]); }}
              disabled={loading || levels.length === 0}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3"
            >
              <option value="">اختر المستوى</option>
              {levels.map(level => <option key={level.id} value={level.id}>{level.nameAr}</option>)}
            </select>
          </label>

          <fieldset className="rounded-xl border border-white/10 p-4" disabled={!selectedLevelId || loading || subjects.length === 0}>
            <legend className="px-2 text-sm font-semibold">المواد المنشورة</legend>
            {subjects.length === 0 ? (
              <p className="text-sm text-slate-400">لا توجد مواد منشورة لهذا المستوى حالياً.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {subjects.map(subject => (
                  <label key={subject.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox" checked={selectedSubjectIds.includes(subject.id)}
                      onChange={event => toggleSubject(subject.id, event.target.checked)}
                      className="h-4 w-4 accent-violet-500"
                    />
                    <span>{subject.nameAr}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          {loading && <p className="text-sm text-slate-400">جارٍ تحميل المنهاج المنشور…</p>}
          {!loading && levels.length === 0 && <p className="text-sm text-amber-200">لا توجد مستويات منشورة للتقديم حالياً. لن نقبل اختيارات من المنهاج المخفي أو قيد المراجعة.</p>}
          {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/5 p-3 text-sm text-red-200">{error}</p>}
          {notice && <p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-3 text-sm text-emerald-200">{notice}</p>}

          <button
            type="submit"
            disabled={submitting || loading || levels.length === 0 || subjects.length === 0}
            className="w-full rounded-xl bg-violet-600 px-4 py-3 font-bold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'جارٍ إرسال الطلب…' : 'إرسال طلب الانضمام'}
          </button>
        </form>
      )}

      {!user && error && <p role="alert" className="mt-4 text-sm text-red-200">{error}</p>}
    </main>
  );
}
