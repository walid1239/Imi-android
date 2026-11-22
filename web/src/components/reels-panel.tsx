'use client';

import { User } from 'firebase/auth';

export default function ReelsPanel({ user }: { user: User }) {
  const signedIn = Boolean(user.uid);
  return (
    <section dir="rtl" className="space-y-5">
      <header className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
        <h3 className="font-bold">Reels</h3>
        <p className="mt-2 text-sm leading-7 text-slate-300">
          رفع الفيديو وتشغيله ومراجعته متوقف مؤقتاً في المرحلة المجانية.
        </p>
        <p className="mt-2 text-xs leading-6 text-slate-400">
          Firebase Cloud Storage يتطلب خطة Blaze، بينما IMI ملتزم حالياً بخطة Spark فقط.
          لذلك لا نرفع الفيديوهات ولا نحاول الوصول إلى ملفات تخزين غير متاحة.
          ستعود هذه الوظائف عند اعتماد مزود تخزين مجاني مناسب بموافقتك.
        </p>
        <p className="mt-3 text-xs text-slate-500">
          {signedIn ? 'حسابك مسجل؛ يمكنك متابعة استخدام الرسائل النصية والحالات النصية.' : 'سجّل الدخول لاستخدام بقية ميزات IMI المتاحة.'}
        </p>
      </header>
    </section>
  );
}
