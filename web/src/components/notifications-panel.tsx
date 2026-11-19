'use client';

import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

type NotificationItem = {
  id: string;
  preview: string;
  senderUid: string;
  conversationId: string;
  createdAt: Timestamp | null;
  readAt: Timestamp | null;
};

function formatDate(value: Timestamp | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ar', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }).format(value.toDate());
}

export default function NotificationsPanel({ user }: { user: User }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const notificationsQuery = query(
      collection(db, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    return onSnapshot(notificationsQuery, snapshot => {
      setItems(snapshot.docs.map(item => ({
        id: item.id,
        preview: item.get('preview') ?? 'إشعار جديد',
        senderUid: item.get('senderUid') ?? '',
        conversationId: item.get('conversationId') ?? '',
        createdAt: item.get('createdAt') ?? null,
        readAt: item.get('readAt') ?? null
      })));
      setError('');
    }, reason => setError(reason.message));
  }, [user.uid]);

  const unreadCount = items.filter(item => !item.readAt).length;

  async function markRead(item: NotificationItem) {
    if (item.readAt) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'notifications', item.id), { readAt: serverTimestamp() });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر تحديث الإشعار.');
    }
  }

  return <div className="relative">
    <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label={`الإشعارات، غير المقروء: ${unreadCount}`} className="relative rounded-xl border border-white/15 px-3 py-2 text-sm">
      <span aria-hidden="true">🔔</span><span className="mr-2">الإشعارات</span>
      {unreadCount > 0 && <span className="mr-2 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">{unreadCount}</span>}
    </button>
    {open && <section className="absolute left-0 top-full z-30 mt-2 max-h-96 w-[min(90vw,360px)] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-3 shadow-2xl" aria-label="قائمة الإشعارات">
      <h2 className="mb-3 font-bold">آخر الإشعارات</h2>
      {items.length === 0 && <p className="py-6 text-center text-sm text-slate-400">لا توجد إشعارات بعد.</p>}
      <div className="space-y-2">{items.map(item => <button key={item.id} type="button" onClick={() => markRead(item)} className={`w-full rounded-xl p-3 text-right ${item.readAt ? 'bg-white/[.035]' : 'bg-blue-500/10 ring-1 ring-blue-500/20'}`}>
        <span className="block text-sm font-semibold">{item.preview}</span>
        <span className="mt-1 block text-[11px] text-slate-400">من مستخدم {item.senderUid.slice(0, 8)} · {formatDate(item.createdAt)}</span>
        {!item.readAt && <span className="mt-2 block text-[10px] text-blue-300">اضغط لوضع علامة مقروء</span>}
      </button>)}</div>
      {error && <p role="alert" className="mt-2 text-xs text-rose-300">{error}</p>}
    </section>}
  </div>;
}
