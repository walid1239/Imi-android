'use client';

import { useEffect, useState } from 'react';
import { getIdTokenResult, onAuthStateChanged, User } from 'firebase/auth';
import { auth, firebaseConfigured } from '@/lib/firebase/client';

export default function TeacherStudioPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => onAuthStateChanged(auth, async current => {
    setUser(current);
    if (!current) {
      setVerified(false);
      setChecking(false);
      return;
    }
    try {
      const token = await getIdTokenResult(current, true);
      setVerified(token.claims.teacherVerified === true);
    } catch {
      setVerified(false);
    } finally {
      setChecking(false);
    }
  }), []);

  if (!firebaseConfigured) {
    return <main dir="rtl" className="mx-auto max-w-3xl p-6 text-amber-200">إعداد Firebase غير مكتمل.</main>;
  }
  if (checking) {
    return <main dir="rtl" className="mx-auto max-w-3xl p-6 text-slate-400">جارٍ التحقق من الحساب…</main>;
  }
  if (!user) {
    return <main dir="rtl" className="mx-auto max-w-3xl p-6 text-slate-300">سجّل الدخول للوصول إلى استوديو الأستاذ.</main>;
  }
  if (!verified) {
    return <main dir="rtl" className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-black">استوديو الأستاذ</h1>
      <p className="mt-3 text-slate-400">حسابك غير موثّق كأستاذ. قدّم طلب التوثيق أولاً.</p>
      <a href="/teacher/apply" className="mt-4 inline-block rounded-xl bg-violet-600 px-4 py-2 font-bold">طلب توثيق</a>
    </main>;
  }
  return <main dir="rtl" className="mx-auto min-h-screen max-w-3xl space-y-5 p-5 text-slate-100">
    <header className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-slate-950 p-6">
      <p className="text-xs font-bold text-violet-300">IMI ACADEMY · TEACHER STUDIO</p>
      <h1 className="mt-2 text-2xl font-black">استوديو الأستاذ</h1>
      <p className="mt-2 text-sm leading-7 text-slate-400">استوديو الأستاذ قيد التجهيز للمرحلة المجانية الأولى. أوقفنا مؤقتاً رفع الصور والملفات، نشر صفحات الأساتذة، وإنشاء الجلسات المباشرة إلى حين نقل عملياتها إلى خادم IMI الموثوق واختبارها. لم يتم إرسال أي ملف إلى Firebase Storage.</p>
    </header>
    <p className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm leading-7 text-amber-100">يمكنك متابعة استخدام بقية التطبيق. ستعود أدوات الأستاذ بعد اكتمال نقل العمليات النصية وحماية الصلاحيات، دون الحاجة إلى Firebase Blaze.</p>
  </main>;
}
