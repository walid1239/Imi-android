'use client';

import { User } from 'firebase/auth';

export default function ReelsPanel({ user }: { user: User }) {
  void user;
  return <section dir="rtl" className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
    <h2 className="text-xl font-bold">مقاطع IMI</h2>
    <p className="mt-3 text-sm leading-7 text-slate-300">ميزة Reels ورفع الفيديوهات مؤجلة في المرحلة المجانية الأولى، حتى نعتمد مزود تخزين متوافقاً مع شروط الاستخدام المجاني.</p>
    <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-6 text-amber-100">لن يظهر زر رفع غير عامل، ولن نحاول الاتصال بـ Firebase Storage في هذه المرحلة.</p>
  </section>;
}
