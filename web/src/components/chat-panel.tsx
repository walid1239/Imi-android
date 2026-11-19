'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp,
  where, writeBatch, Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

type Conversation = {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: Timestamp | null;
};
type Message = {
  id: string;
  senderUid: string;
  type: string;
  text: string;
  createdAt: Timestamp | null;
};

function timeLabel(value: Timestamp | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ar', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }).format(value.toDate());
}

export default function ChatPanel({ user }: { user: User }) {
  const [chats, setChats] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc'),
      limit(50)
    );
    return onSnapshot(q, snapshot => {
      const rows = snapshot.docs.map(item => ({
        id: item.id,
        participants: (item.get('participants') as string[]) ?? [],
        lastMessage: item.get('lastMessage') ?? '',
        lastMessageAt: item.get('lastMessageAt') ?? null
      }));
      setChats(rows);
      setSelectedId(current => current && rows.some(row => row.id === current) ? current : (rows[0]?.id ?? ''));
      setLoadingChats(false);
      setError('');
    }, reason => {
      setLoadingChats(false);
      setError(reason.message);
    });
  }, [user.uid]);

  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    setLoadingMessages(true);
    const q = query(
      collection(db, 'conversations', selectedId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(200)
    );
    return onSnapshot(q, snapshot => {
      setMessages(snapshot.docs.map(item => ({
        id: item.id,
        senderUid: item.get('senderUid') ?? '',
        type: item.get('type') ?? 'text',
        text: item.get('text') ?? '',
        createdAt: item.get('createdAt') ?? null
      })));
      setLoadingMessages(false);
      setError('');
    }, reason => {
      setLoadingMessages(false);
      setError(reason.message);
    });
  }, [selectedId]);

  const selected = useMemo(() => chats.find(chat => chat.id === selectedId), [chats, selectedId]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!selectedId || !text || busy) return;
    if (text.length > 1000) { setError('الرسالة أطول من 1000 حرف.'); return; }
    setBusy(true);
    setError('');
    try {
      const conversationRef = doc(db, 'conversations', selectedId);
      const messageRef = doc(collection(conversationRef, 'messages'));
      const batch = writeBatch(db);
      batch.set(messageRef, {
        senderUid: user.uid,
        type: 'text',
        text,
        createdAt: serverTimestamp()
      });
      batch.update(conversationRef, {
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
        lastSenderUid: user.uid
      });
      await batch.commit();
      setDraft('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر إرسال الرسالة.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="grid min-h-[520px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 md:grid-cols-[minmax(220px,0.8fr)_1.5fr]" dir="rtl">
    <aside className="border-b border-white/10 p-3 md:border-b-0 md:border-l">
      <div className="mb-3 flex items-center justify-between"><h3 className="font-bold">محادثاتي</h3><span className="text-xs text-slate-500">{chats.length}</span></div>
      {loadingChats ? <p className="p-4 text-sm text-slate-400">جارٍ تحميل المحادثات…</p> : chats.length === 0 ? <p className="rounded-xl bg-white/[.04] p-4 text-sm leading-7 text-slate-400">لا توجد محادثات مرتبطة بهذا الحساب بعد. عندما تبدأ محادثة من تطبيق IMI ستظهر هنا.</p> :
        <div className="space-y-2">{chats.map(chat => {
          const other = chat.participants.find(uid => uid !== user.uid);
          return <button key={chat.id} onClick={() => setSelectedId(chat.id)} className={`w-full rounded-xl p-3 text-right ${selectedId === chat.id ? 'bg-blue-600/20 ring-1 ring-blue-500/50' : 'bg-white/[.035] hover:bg-white/[.07]'}`}>
            <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{other ? `مستخدم ${other.slice(0, 8)}` : 'محادثة جماعية'}</span><span className="shrink-0 text-[10px] text-slate-500">{timeLabel(chat.lastMessageAt)}</span></div>
            <p className="mt-2 truncate text-xs text-slate-400">{chat.lastMessage || 'ابدأ المحادثة'}</p>
          </button>;
        })}</div>}
    </aside>
    <div className="flex min-h-[420px] flex-col">
      <header className="border-b border-white/10 px-4 py-3"><h3 className="font-bold">{selected ? 'المحادثة' : 'الرسائل'}</h3><p className="mt-1 text-xs text-slate-500">{selected ? selected.id : 'اختر محادثة من القائمة'}</p></header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {!selectedId && <p className="py-16 text-center text-sm text-slate-500">لا توجد محادثة محددة.</p>}
        {selectedId && loadingMessages && <p className="text-sm text-slate-400">جارٍ تحميل الرسائل…</p>}
        {selectedId && !loadingMessages && messages.length === 0 && <p className="py-16 text-center text-sm text-slate-500">لا توجد رسائل بعد. أرسل أول رسالة.</p>}
        {messages.map(message => <div key={message.id} className={`flex ${message.senderUid === user.uid ? 'justify-start' : 'justify-end'}`}><article className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.senderUid === user.uid ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-100'}`}><p className="whitespace-pre-wrap break-words text-sm">{message.type === 'text' ? message.text : `[رسالة من نوع ${message.type}]`}</p><time className="mt-2 block text-left text-[10px] opacity-60">{timeLabel(message.createdAt)}</time></article></div>)}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-white/10 p-3"><input value={draft} onChange={event => setDraft(event.target.value)} maxLength={1000} disabled={!selectedId || busy} placeholder="اكتب رسالتك…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50" /><button disabled={!selectedId || !draft.trim() || busy} className="rounded-xl bg-blue-600 px-5 text-sm font-bold disabled:opacity-40">{busy ? '…' : 'إرسال'}</button></form>
    </div>
    {error && <p role="alert" className="col-span-full border-t border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-6 text-amber-200">تعذر تحميل البيانات أو تنفيذ العملية: {error}. قد يتطلب الاستعلام فهرس Firestore أو صلاحيات مناسبة.</p>}
  </section>;
}
