'use client';

import { User } from 'firebase/auth';

export default function TeacherContentPanel({ user }: { user: User }) {
  void user;
  return <section dir="rtl" className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
    <h2 className="font-bold text-amber-100">إضافة المحتوى متوقفة مؤقتاً</h2>
    <p className="mt-2 text-sm leading-7 text-amber-100/80">سيعود نشر الدروس النصية بعد اكتمال نقل صلاحيات الأستاذ إلى خادم IMI واختبارها. رفع الفيديو والصور وPDF غير متاح في المرحلة المجانية الأولى.</p>
  </section>;
}
