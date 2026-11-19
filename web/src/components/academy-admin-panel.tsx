'use client';

import { useEffect, useState } from 'react';
import { User, getIdTokenResult } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '@/lib/firebase/client';

type Course = { id: string; title: string; description: string; category: string; published: boolean };
type Lesson = { id: string; title: string; content: string; videoUrl?: string; order: number; published: boolean; sourceType?: string; sourceName?: string; reviewStatus?: string };

export default function AcademyAdminPanel({ user }: { user: User }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [content, setContent] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [order, setOrder] = useState('0');
  const [sourceType, setSourceType] = useState('original');
  const [sourceName, setSourceName] = useState('محتوى أصلي من IMI');
  const [sourceUrl, setSourceUrl] = useState('');
  const [license, setLicense] = useState('محتوى أصلي مملوك لـ IMI');
  const [permissionNote, setPermissionNote] = useState('مسودة أصلية تحتاج مراجعة بشرية قبل النشر');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    getIdTokenResult(user, true).then(result => {
      if (active) setAuthorized(result.claims.admin === true);
    }).catch(() => { if (active) setAuthorized(false); });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!authorized) return;
    return onSnapshot(query(collection(db, 'courses'), orderBy('createdAt', 'desc')), snapshot => {
      const rows = snapshot.docs.map(item => ({
        id: item.id, title: item.get('title') || 'دورة بلا عنوان',
        description: item.get('description') || '', category: item.get('category') || '',
        published: item.get('published') === true,
      }));
      setCourses(rows);
      setSelectedId(current => current && rows.some(row => row.id === current) ? current : (rows[0]?.id ?? ''));
    }, reason => setError(reason.message));
  }, [authorized]);

  useEffect(() => {
    if (!authorized || !selectedId) { setLessons([]); return; }
    return onSnapshot(query(collection(db, 'courses', selectedId, 'lessons'), orderBy('order', 'asc')), snapshot => {
      setLessons(snapshot.docs.map(item => ({
        id: item.id, title: item.get('title') || 'درس بلا عنوان',
        content: item.get('content') || '', videoUrl: item.get('videoUrl') || undefined,
        order: typeof item.get('order') === 'number' ? item.get('order') : 0,
        published: item.get('published') === true,
        sourceType: typeof item.get('sourceType') === 'string' ? item.get('sourceType') : undefined,
        sourceName: typeof item.get('sourceName') === 'string' ? item.get('sourceName') : undefined,
        reviewStatus: typeof item.get('reviewStatus') === 'string' ? item.get('reviewStatus') : undefined,
      })));
    }, reason => setError(reason.message));
  }, [authorized, selectedId]);

  async function call<T extends Record<string, unknown>>(name: string, payload: T, success: string) {
    setBusy(true); setError(''); setNotice('');
    try {
      await httpsCallable(getFunctions(), name)(payload);
      setNotice(success);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر تنفيذ العملية.');
    } finally { setBusy(false); }
  }

  async function createCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await call('createCourse', { title, description, category }, 'تم إنشاء الدورة كمسودة.');
    setTitle(''); setDescription(''); setCategory('');
  }

  async function createLesson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    await call('createCourseLesson', {
      courseId: selectedId, title: lessonTitle, content, videoUrl,
      order: Number(order), sourceType, sourceName, sourceUrl, license, permissionNote,
    }, 'تمت إضافة الدرس كمسودة. لا يمكن نشره قبل استكمال بيانات المصدر ومراجعته.');
    setLessonTitle(''); setContent(''); setVideoUrl(''); setOrder(String(lessons.length + 1));
  }

  if (authorized === null) return <section dir="rtl" className="rounded-2xl border border-white/10 p-6 text-sm text-slate-400">جارٍ التحقق من صلاحية المشرف من رمز Firebase…</section>;
  if (!authorized) return <section dir="rtl" className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6"><h2 className="font-bold">هذه الصفحة للمشرفين فقط</h2><p className="mt-2 text-sm leading-7 text-slate-400">حسابك لا يحمل صلاحية admin موثقة. لا يمكن تفعيلها من واجهة التطبيق.</p></section>;

  const selected = courses.find(course => course.id === selectedId) ?? null;
  return <section dir="rtl" className="space-y-5">
    <header className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
      <p className="text-xs font-semibold text-violet-300">IMI ACADEMY · ADMIN</p>
      <h2 className="mt-2 text-2xl font-black">إدارة الأكاديمية</h2>
      <p className="mt-2 text-sm text-slate-400">أنشئ محتوى حقيقياً كمسودات ثم انشره بعد مراجعته. صلاحية المشرف يتحقق منها Firebase.</p>
    </header>

    <form onSubmit={createCourse} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <h3 className="font-bold">إنشاء دورة جديدة</h3>
      <input required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="عنوان الدورة" className="rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm outline-none focus:border-blue-500" />
      <input required maxLength={60} value={category} onChange={e => setCategory(e.target.value)} placeholder="التصنيف" className="rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm outline-none focus:border-blue-500" />
      <textarea maxLength={4000} value={description} onChange={e => setDescription(e.target.value)} placeholder="وصف الدورة" rows={3} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm outline-none focus:border-blue-500" />
      <button disabled={busy} className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold disabled:opacity-40">إنشاء كمسودة</button>
    </form>

    <div className="grid gap-4 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
      <div className="space-y-2">
        <h3 className="font-bold">الدورات ({courses.length})</h3>
        {courses.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-500">لا توجد دورات بعد.</p>}
        {courses.map(course => <button key={course.id} onClick={() => setSelectedId(course.id)} className={`w-full rounded-xl border p-4 text-right ${selectedId === course.id ? 'border-violet-500 bg-violet-500/10' : 'border-white/10 bg-slate-950/40'}`}>
          <span className="flex items-center justify-between gap-2"><strong className="text-sm">{course.title}</strong><span className={`text-[10px] ${course.published ? 'text-emerald-300' : 'text-amber-300'}`}>{course.published ? 'منشورة' : 'مسودة'}</span></span>
          <span className="mt-1 block text-xs text-slate-500">{course.category}</span>
        </button>)}
      </div>

      {selected && <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-bold">{selected.title}</h3><p className="mt-1 text-xs text-slate-500">{lessons.length} درس</p></div>
          <button disabled={busy || (!selected.published && lessons.length === 0)} onClick={() => call('publishCourse', { courseId: selected.id, published: !selected.published }, selected.published ? 'تم إلغاء نشر الدورة.' : 'تم نشر الدورة.')} className="rounded-lg border border-white/15 px-3 py-2 text-xs disabled:opacity-40">{selected.published ? 'إلغاء النشر' : 'نشر الدورة'}</button>
        </div>

        {lessons.map(lesson => <div key={lesson.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3">
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{lesson.title}</p><p className="mt-1 text-[10px] text-slate-500">الترتيب {lesson.order} · {lesson.published ? 'منشور' : 'مسودة'} · {lesson.sourceName || 'مصدر غير محدد'} · {lesson.reviewStatus || 'بانتظار المراجعة'}</p></div>
          <button disabled={busy || (!selected.published && !lesson.published)} onClick={() => call('publishCourseLesson', { courseId: selected.id, lessonId: lesson.id, published: !lesson.published }, lesson.published ? 'تم إخفاء الدرس.' : 'تم نشر الدرس.')} className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-xs disabled:opacity-40">{lesson.published ? 'إخفاء' : 'نشر'}</button>
        </div>)}

        {!selected.published && <form onSubmit={createLesson} className="space-y-3 rounded-xl border border-dashed border-white/15 p-3">
          <h4 className="text-sm font-bold">إضافة درس</h4>
          <input required maxLength={120} value={lessonTitle} onChange={e => setLessonTitle(e.target.value)} placeholder="عنوان الدرس" className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm" />
          <textarea maxLength={20000} rows={4} value={content} onChange={e => setContent(e.target.value)} placeholder="المحتوى النصي (اختياري)" className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm" />
          <input type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="رابط فيديو HTTPS (اختياري)" className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm" />
          <input type="number" min={0} max={100000} step={1} value={order} onChange={e => setOrder(e.target.value)} aria-label="ترتيب الدرس" className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm" />
          <label className="block text-xs text-slate-400">نوع المصدر
            <select value={sourceType} onChange={e => setSourceType(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100">
              <option value="official">مصدر رسمي</option><option value="open-license">ترخيص مفتوح</option><option value="embed">تضمين رسمي</option><option value="original">محتوى أصلي</option><option value="teacher-agreement">محتوى أستاذ باتفاق</option>
            </select>
          </label>
          <input required maxLength={160} value={sourceName} onChange={e => setSourceName(e.target.value)} placeholder="اسم المصدر أو صاحب المحتوى" className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm" />
          <input type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="رابط المصدر HTTPS (إلزامي للرسمي والمفتوح والتضمين)" className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm" />
          <input required maxLength={160} value={license} onChange={e => setLicense(e.target.value)} placeholder="الترخيص أو أساس الإذن" className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm" />
          <textarea required maxLength={1000} rows={2} value={permissionNote} onChange={e => setPermissionNote(e.target.value)} placeholder="ملاحظة الإذن والمراجعة البشرية أو الاتفاق" className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm" />
          <p className="text-[11px] leading-5 text-amber-300">لا يُنشر أي درس دون مصدر وترخيص/إذن موثق ومراجع معتمد. المحتوى الأصلي يحتاج مراجعة بشرية، ومحتوى الأستاذ يحتاج اتفاقاً موثقاً.</p>
          <button disabled={busy} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold disabled:opacity-40">إضافة الدرس كمسودة</button>
        </form>}
        {selected.published && <p className="text-xs leading-6 text-slate-500">لإضافة دروس جديدة، ألغِ نشر الدورة أولاً. بعد الإضافة أعد نشر الدروس والدورة.</p>}
      </div>}
    </div>
    {error && <p role="alert" className="rounded-xl bg-amber-500/10 p-3 text-xs leading-6 text-amber-200">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-500/10 p-3 text-xs leading-6 text-emerald-200">{notice}</p>}
  </section>;
}
