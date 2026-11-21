'use client';

import { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, doc, endAt, getDoc, onSnapshot, orderBy, query, startAt, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { postAuthenticated } from '@/lib/api';

type PublicProfile = { uid: string; displayName: string; city?: string; photoPath?: string };
type FriendRequest = { id: string; fromUid: string; toUid: string };
type Friend = { uid: string; displayName: string; city?: string };

export default function FriendsPanel({ user }: { user: User }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const requestsQuery = query(collection(db, 'friendRequests'), where('toUid', '==', user.uid));
    return onSnapshot(requestsQuery, snapshot => {
      setIncoming(snapshot.docs
        .filter(item => item.get('status') === 'pending')
        .map(item => ({ id: item.id, fromUid: item.get('fromUid'), toUid: item.get('toUid') }))
        .filter(item => typeof item.fromUid === 'string' && typeof item.toUid === 'string'));
    }, reason => setError(reason.message));
  }, [user.uid]);

  useEffect(() => {
    return onSnapshot(collection(db, 'users', user.uid, 'friends'), async snapshot => {
      const items = await Promise.all(snapshot.docs
        .filter(item => item.get('status') === 'accepted')
        .map(async item => {
          const uid = item.id;
          const profile = await getDoc(doc(db, 'publicProfiles', uid));
          return {
            uid,
            displayName: profile.exists() ? profile.get('displayName') || 'مستخدم IMI' : 'مستخدم IMI',
            city: profile.exists() ? profile.get('city') || '' : '',
          };
        }));
      setFriends(items);
    }, reason => setError(reason.message));
  }, [user.uid]);

  useEffect(() => {
    const value = term.trim();
    if (value.length < 2) { setResults([]); return; }
    const directoryQuery = query(
      collection(db, 'publicProfiles'),
      orderBy('displayName'),
      startAt(value),
      endAt(value + '\uf8ff')
    );
    return onSnapshot(directoryQuery, snapshot => {
      setResults(snapshot.docs
        .map(item => ({
          uid: item.id,
          displayName: item.get('displayName') || 'مستخدم IMI',
          city: item.get('city') || '',
          photoPath: item.get('photoPath') || undefined,
        }))
        .filter(item => item.uid !== user.uid)
        .slice(0, 20));
    }, reason => setError(reason.message));
  }, [term, user.uid]);

  const friendIds = useMemo(() => new Set(friends.map(item => item.uid)), [friends]);

  async function call(name: string, payload: Record<string, string>, key: string, success: string) {
    setBusy(key); setError(''); setNotice('');
    try {
      const routes: Record<string, string> = {
        sendFriendRequest: '/api/v1/friends/requests',
        acceptFriendRequest: '/api/v1/friends/requests/accept',
        rejectFriendRequest: '/api/v1/friends/requests/reject',
        removeFriend: '/api/v1/friends/remove',
      };
      const path = routes[name];
      if (!path) throw new Error('هذه العملية غير متاحة.');
      await postAuthenticated<{ status?: string; requestId?: string }>(user, path, payload);
      setNotice(success);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر تنفيذ العملية.');
    } finally {
      setBusy('');
    }
  }

  return <section dir="rtl" className="space-y-5">
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <h2 className="font-bold">ابحث عن أصدقاء</h2>
      <p className="mt-1 text-xs leading-6 text-slate-400">ابحث بالاسم الظاهر في دليل IMI، ثم أرسل طلب صداقة عبر الخادم.</p>
      <input value={term} onChange={event => setTerm(event.target.value)} placeholder="اكتب حرفين على الأقل من الاسم…" className="mt-3 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-blue-500" />
      {results.length > 0 && <div className="mt-3 divide-y divide-white/10">
        {results.map(profile => <div key={profile.uid} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{profile.displayName}</p><p className="mt-1 truncate text-xs text-slate-500">{profile.city || 'عضو في IMI'}</p></div>
          {friendIds.has(profile.uid)
            ? <span className="shrink-0 text-xs text-emerald-300">صديق</span>
            : <button aria-label="إضافة" data-testid={`add-friend-${profile.uid}`} disabled={!!busy} onClick={() => call('sendFriendRequest', { toUid: profile.uid }, profile.uid, 'أُرسل طلب الصداقة.')} className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold disabled:opacity-40">{busy === profile.uid ? 'جارٍ الإرسال…' : 'إضافة'}</button>}
        </div>)}
      </div>}
      {term.trim().length >= 2 && results.length === 0 && <p className="mt-3 text-xs text-slate-500">لا توجد نتائج مطابقة حالياً.</p>}
    </div>

    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between"><h2 className="font-bold">طلبات الصداقة الواردة</h2><span className="rounded-full bg-white/10 px-2 py-1 text-xs">{incoming.length}</span></div>
      {incoming.length === 0 ? <p className="mt-3 text-sm text-slate-500">لا توجد طلبات معلّقة.</p> : <div className="mt-2 divide-y divide-white/10">
        {incoming.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <span className="text-xs text-slate-300">طلب من مستخدم <span className="font-mono">{item.fromUid.slice(0, 9)}…</span></span>
          <div className="flex gap-2">
            <button disabled={!!busy} onClick={() => call('acceptFriendRequest', { requestId: item.id }, item.id, 'تم قبول طلب الصداقة.')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold disabled:opacity-40">قبول</button>
            <button disabled={!!busy} onClick={() => call('rejectFriendRequest', { requestId: item.id }, item.id, 'تم رفض طلب الصداقة.')} className="rounded-lg border border-white/15 px-3 py-2 text-xs disabled:opacity-40">رفض</button>
          </div>
        </div>)}
      </div>}
    </div>

    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between"><h2 className="font-bold">أصدقائي</h2><span className="rounded-full bg-white/10 px-2 py-1 text-xs">{friends.length}</span></div>
      {friends.length === 0 ? <p className="mt-3 text-sm text-slate-500">قائمة الأصدقاء فارغة حالياً.</p> : <div className="mt-2 divide-y divide-white/10">
        {friends.map(friend => <div key={friend.uid} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{friend.displayName}</p><p className="mt-1 truncate text-xs text-slate-500">{friend.city || 'عضو في IMI'}</p></div>
          <button disabled={!!busy} onClick={() => call('removeFriend', { friendUid: friend.uid }, friend.uid, 'تم حذف الصديق من قائمتك.')} className="shrink-0 rounded-lg border border-rose-500/25 px-3 py-2 text-xs text-rose-300 disabled:opacity-40">إزالة</button>
        </div>)}
      </div>}
    </div>
    {error && <p role="alert" className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-6 text-amber-200">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs leading-6 text-emerald-200">{notice}</p>}
    <p className="text-xs leading-6 text-slate-500">إرسال الطلب وقبوله ورفضه وإزالة الصديق تتم عبر مسارات الخادم الموثوقة مع التحقق من هوية المستخدم وصلاحياته.</p>
  </section>;
}
