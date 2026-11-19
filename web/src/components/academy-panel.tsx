'use client';

import { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '@/lib/firebase/client';

type Course = { id: string; title: string; description: string; category: string; coverUrl?: string };
type Lesson = { id: string; title: string; content: string; videoUrl?: string; order: number };
type Enrollment = { completedLessonIds: string[] };

export default function AcademyPanel({ user }: { user: User | null }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedCourse = courses.find(course => course.id === courseId) ?? null;
  const completed = useMemo(() => new Set(enrollment?.completedLessonIds ?? []), [enrollment]);
  const progress = lessons.length ? Math.round(lessons.filter(lesson => completed.has(lesson.id)).length / lessons.length * 100) : 0;
  const selectedLesson = lessons.find(lesson => lesson.id === selectedLessonId) ?? null;

  useEffect(() => {
    const publishedCourses = query(collection(db, 'courses'), where('published', '==', true));
    return onSnapshot(publishedCourses, snapshot => {
      const items = snapshot.docs.map(item => ({
        id: item.id,
        title: item.get('title') || 'دورة تعليمية',
        description: item.get('description') || '',
        category: item.get('category') || 'عام',
        coverUrl: item.get('coverUrl') || undefined,
      }));
      setCourses(items);
      setCourseId(current => current && items.some(item => item.id === current) ? current : (items[0]?.id ?? ''));
      setLoadingCourses(false);
    }, reason => {
      setError(reason.message);
      setLoadingCourses(false);
    });
  }, []);

  useEffect(() => {
    setLessons([]);
    setSelectedLessonId('');
    if (!courseId) return;
    const publishedLessons = query(
      collection(db, 'courses', courseId, 'lessons'),
      where('published', '==', true)
    );
    return onSnapshot(publishedLessons, snapshot => {
      const items = snapshot.docs.map(item => ({
        id: item.id,
        title: item.get('title') || 'درس',
        content: item.get('content') || '',
        videoUrl: item.get('videoUrl') || undefined,
        order: typeof item.get('order') === 'number' ? item.get('order') : 0,
      })).sort((a, b) => a.order - b.order);
      setLessons(items);
      setSelectedLessonId(current => current && items.some(item => item.id === current) ? current : (items[0]?.id ?? ''));
    }, reason => setError(reason.message));
  }, [courseId]);

  useEffect(() => {
    setEnrollment(null);
    if (!courseId) return;
    if (!user) {
      try {
        const saved = localStorage.getItem(`imi-academy-progress:${courseId}`);
        const ids: unknown = saved ? JSON.parse(saved) : [];
        setEnrollment({ completedLessonIds: Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [] });
      } catch {
        setEnrollment({ completedLessonIds: [] });
      }
      return;
    }
    return onSnapshot(doc(db, 'users', user.uid, 'enrollments', courseId), snapshot => {
      if (!snapshot.exists()) { setEnrollment(null); return; }
      const ids = snapshot.get('completedLessonIds');
      setEnrollment({ completedLessonIds: Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [] });
    }, reason => setError(reason.message));
  }, [courseId, user?.uid]);

  async function runCallable(name: 'enrollInCourse' | 'completeCourseLesson', payload: Record<string, string>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const action = httpsCallable<Record<string, string>, { status: string }>(getFunctions(), name);
      await action(payload);
      setNotice(success);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر تنفيذ العملية التعليمية.');
    } finally {
      setBusy(false);
    }
  }

  function completeGuestLesson(lessonId: string) {
    const next = [...new Set([...(enrollment?.completedLessonIds ?? []), lessonId])];
    try { localStorage.setItem(`imi-academy-progress:${courseId}`, JSON.stringify(next)); }
    catch { setError('تعذر حفظ التقدم محلياً على هذا الجهاز.'); return; }
    setEnrollment({ completedLessonIds: next });
    setNotice('تم حفظ تقدمك على هذا الجهاز دون إنشاء حساب.');
  }

  return <section dir="rtl" className="space-y-5">
    <header className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
      <p className="text-xs font-semibold text-blue-300">IMI ACADEMY</p>
      <h2 className="mt-2 text-2xl font-black">تعلّم وتقدّم</h2>
      <p className="mt-2 text-sm leading-7 text-slate-400">الدورات والدروس المنشورة فقط تظهر هنا. لا نعرض محتوى تجريبياً عند عدم وجود دورات منشورة.</p>
    </header>

    {loadingCourses ? <p className="rounded-2xl border border-white/10 p-6 text-center text-sm text-slate-400">جارٍ تحميل الدورات المنشورة…</p>
      : courses.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
        <h3 className="font-bold">لا توجد دورات منشورة حالياً</h3>
        <p className="mt-2 text-sm leading-7 text-slate-500">عندما ينشر المشرفون دورات حقيقية في مجموعة courses ستظهر هنا تلقائياً.</p>
      </div>
      : <div className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-2">
          {courses.map(course => <button key={course.id} onClick={() => setCourseId(course.id)} aria-pressed={courseId === course.id} className={`w-full rounded-xl border p-4 text-right ${courseId === course.id ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 bg-slate-950/50'}`}>
            <span className="text-[11px] text-blue-300">{course.category}</span>
            <span className="mt-1 block font-bold">{course.title}</span>
            {course.description && <span className="mt-2 block line-clamp-2 text-xs leading-6 text-slate-400">{course.description}</span>}
          </button>)}
        </div>

        {selectedCourse && <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <div>
            <h3 className="text-xl font-bold">{selectedCourse.title}</h3>
            {selectedCourse.description && <p className="mt-2 text-sm leading-7 text-slate-400">{selectedCourse.description}</p>}
          </div>
          {enrollment
            ? <div className="rounded-xl bg-white/5 p-3">
              <div className="flex justify-between text-xs"><span>تقدمك في الدورة</span><span>{progress}%</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} /></div>
              <p className="mt-2 text-[11px] text-slate-500">{completed.size} من {lessons.length} دروس مكتملة{user ? '' : ' · محفوظ على هذا الجهاز'}</p>
            </div>
            : user ? <button disabled={busy} onClick={() => runCallable('enrollInCourse', { courseId }, 'تم تسجيلك في الدورة.')} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold disabled:opacity-40">{busy ? 'جارٍ التسجيل…' : 'سجّل في هذه الدورة'}</button> : null}

          <div className="space-y-2">
            <h4 className="font-bold">محتوى الدورة</h4>
            {lessons.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-slate-500">لا توجد دروس منشورة في هذه الدورة بعد.</p>
              : lessons.map((lesson, index) => <button key={lesson.id} onClick={() => setSelectedLessonId(lesson.id)} className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-right ${selectedLessonId === lesson.id ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10 bg-white/[.02]'}`}>
                <span className="min-w-0"><span className="block text-xs text-slate-500">الدرس {index + 1}</span><span className="mt-1 block truncate text-sm font-semibold">{lesson.title}</span></span>
                <span className={`shrink-0 text-xs ${completed.has(lesson.id) ? 'text-emerald-300' : 'text-slate-500'}`}>{completed.has(lesson.id) ? '✓ مكتمل' : '▶ فتح'}</span>
              </button>)}
          </div>

          {selectedLesson && <article className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h4 className="font-bold">{selectedLesson.title}</h4>
            {selectedLesson.videoUrl && <video controls playsInline preload="metadata" src={selectedLesson.videoUrl} className="mt-3 max-h-80 w-full rounded-lg bg-black" />}
            {selectedLesson.content && <div className="mt-3 whitespace-pre-wrap text-sm leading-8 text-slate-300">{selectedLesson.content}</div>}
            {!selectedLesson.videoUrl && !selectedLesson.content && <p className="mt-3 text-xs text-slate-500">لم يضف المشرف محتوى لهذا الدرس بعد.</p>}
            {enrollment && <button disabled={busy || completed.has(selectedLesson.id)} onClick={() => user
              ? runCallable('completeCourseLesson', { courseId, lessonId: selectedLesson.id }, 'تم تسجيل إكمال الدرس.')
              : completeGuestLesson(selectedLesson.id)} className="mt-4 w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold disabled:opacity-40">{completed.has(selectedLesson.id) ? 'أكملت هذا الدرس' : busy ? 'جارٍ الحفظ…' : 'وضع علامة: أكملت الدرس'}</button>}
          </article>}
        </div>}
      </div>}

    {error && <p role="alert" className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-6 text-amber-200">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs leading-6 text-emerald-200">{notice}</p>}
    <p className="text-xs leading-6 text-slate-500">يُسجّل التقدم عبر Cloud Functions بعد التحقق من نشر الدورة والدرس. إنشاء المحتوى ونشره محصوران بالمشرفين من جهة موثوقة.</p>
  </section>;
}
