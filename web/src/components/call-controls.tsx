'use client';

import type { User } from 'firebase/auth';

export default function CallControls(_props: {
  user: User;
  conversationId?: string;
  calleeUid?: string;
}) {
  return (
    <section
      className="border-b border-white/10 px-4 py-3"
      aria-label="حالة المكالمات"
      dir="rtl"
    >
      <p className="text-sm font-semibold text-slate-200">المكالمات غير جاهزة حالياً</p>
      <p className="mt-1 text-xs leading-6 text-slate-400">
        أوقفنا المكالمات الصوتية والمرئية مؤقتاً إلى حين نقل خدمتها إلى واجهة IMI API واختبار الاتصال الآمن.
        لن يتم إرسال طلب مكالمة أو طلب إذن الميكروفون والكاميرا في هذه النسخة.
      </p>
    </section>
  );
}
