'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

export default function TeacherApplicationPanel() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  return (
    <main dir="rtl" className="mx-auto min-h-screen max-w-3xl px-4 py-8 text-slate-100">
      <header className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-slate-950 p-6">
        <p className="text-xs font-bold text-violet-300">IMI ACADEMY · TEACHERS</p>
        <h1 className="mt-3 text-2xl font-black">طلب الانضمام كأستاذ</h1>
        <p className="mt-2 text-sm leading-7 text-slate-400">
          طلبات توثيق الأساتذة غير متاحة حالياً. لم يتم تجهيز واجهة خادم آمنة لاستلام الوثائق ومراجعتها،
          لذلك لا نطلب منك إدخال بيانات شخصية أو رفع شهادة في هذه المرحلة.
        </p>
      </header>

      <section className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-950/20 p-5" role="status">
        <p className="font-bold text-amber-100">التقديم متوقف مؤقتاً</p>
        <p className="mt-2 text-sm leading-7 text-amber-100/80">
          {user
            ? 'حسابك مسجل، لكن لا يمكن إرسال طلب توثيق أو رفع ملفات حتى تكتمل واجهة IMI API ومراجعة المشرف.'
            : 'يمكنك تسجيل الدخول، لكن إرسال طلب توثيق الأستاذ غير متاح حتى تكتمل واجهة IMI API ومراجعة المشرف.'}
        </p>
        <p className="mt-3 text-xs leading-6 text-slate-400">
          لا تُمنح صلاحية الأستاذ من الواجهة. ستُتاح الطلبات بعد تنفيذ تخزين خاص وآمن، والتحقق من هوية المشرف،
          واختبار صلاحيات الإرسال والمراجعة.
        </p>
      </section>
    </main>
  );
}
