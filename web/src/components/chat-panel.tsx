'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  collection, doc, documentId, endAt, getDoc, getDocs, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  setDoc, startAfter, startAt, where, writeBatch, Timestamp
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, storage } from '@/lib/firebase/client';
import CallControls from '@/components/call-controls';

type Conversation = {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: Timestamp | null;
  type?: string;
  name?: string;
  status?: string;
};
type PublicProfile = { uid: string; displayName: string; city?: string; photoPath?: string };
type Message = {
  id: string;
  senderUid: string;
  type: string;
  text: string;
  createdAt: Timestamp | null;
  mediaPath?: string;
  contentType?: string;
  fileName?: string;
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
  const [attachment, setAttachment] = useState<File | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string | null>>({});
  const [otherReadAt, setOtherReadAt] = useState<Timestamp | null>(null);
  const [otherDeliveredAt, setOtherDeliveredAt] = useState<Timestamp | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherPresenceAt, setOtherPresenceAt] = useState<Timestamp | null>(null);
  const [presenceNow, setPresenceNow] = useState(Date.now());
  const [pageVisible, setPageVisible] = useState(false);
  const lastReadMessageRef = useRef('');
  const lastDeliveredMessageRef = useRef('');
  const lastTypingSentAtRef = useRef(0);
  const otherTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [profileName, setProfileName] = useState(user.displayName || user.email?.split('@')[0] || 'مستخدم IMI');
  const [profileCity, setProfileCity] = useState('المغرب');
  const [profileReady, setProfileReady] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getDoc(doc(db, 'users', user.uid)).then(snapshot => {
      if (!active) return;
      if (snapshot.exists()) {
        setProfileName(snapshot.get('displayName') || user.displayName || user.email?.split('@')[0] || 'مستخدم IMI');
        setProfileCity(snapshot.get('city') || 'المغرب');
      }
      setProfileReady(true);
    }).catch(reason => {
      if (active) {
        setProfileReady(true);
        setError(reason instanceof Error ? reason.message : 'تعذر تحميل الملف الشخصي.');
      }
    });
    return () => { active = false; };
  }, [user.uid, user.displayName, user.email]);

  useEffect(() => onSnapshot(collection(db, 'users', user.uid, 'blockedUsers'), snapshot => {
    setBlockedUsers(snapshot.docs.map(item => item.id));
  }, reason => setError(reason.message)), [user.uid]);

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
        lastMessageAt: item.get('lastMessageAt') ?? null,
        type: item.get('type') ?? 'direct', name: item.get('name') ?? '', status: item.get('status') ?? 'active'
      })).filter(row => row.status !== 'blocked');
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
    if (!selectedId) { setMessages([]); setHasMoreMessages(false); return; }
    setMessages([]);
    setHasMoreMessages(true);
    setLoadingMessages(true);
    const q = query(
      collection(db, 'conversations', selectedId, 'messages'),
      orderBy('createdAt', 'desc'),
      orderBy(documentId(), 'desc'),
      limit(50)
    );
    return onSnapshot(q, snapshot => {
      const latest = snapshot.docs.map(item => ({
        id: item.id,
        senderUid: item.get('senderUid') ?? '',
        type: item.get('type') ?? 'text',
        text: item.get('text') ?? '',
        createdAt: item.get('createdAt') ?? null,
        mediaPath: item.get('mediaPath') ?? undefined,
        contentType: item.get('contentType') ?? undefined,
        fileName: item.get('fileName') ?? undefined
      })).reverse();
      setMessages(current => {
        const latestIds = new Set(latest.map(item => item.id));
        return [...current.filter(item => !latestIds.has(item.id)), ...latest];
      });
      if (snapshot.size < 50) setHasMoreMessages(false);
      setLoadingMessages(false);
      setError('');
    }, reason => {
      setLoadingMessages(false);
      setError(reason.message);
    });
  }, [selectedId]);

  const selected = useMemo(() => chats.find(chat => chat.id === selectedId), [chats, selectedId]);

  const otherUid = selected?.type === 'group' ? '' : (selected?.participants.find(uid => uid !== user.uid) ?? '');

  useEffect(() => {
    const updateVisibility = () => setPageVisible(
      document.visibilityState === 'visible' && document.hasFocus()
    );
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    window.addEventListener('focus', updateVisibility);
    window.addEventListener('blur', updateVisibility);
    return () => {
      document.removeEventListener('visibilitychange', updateVisibility);
      window.removeEventListener('focus', updateVisibility);
      window.removeEventListener('blur', updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (!selectedId || !otherUid) {
      setOtherReadAt(null);
      setOtherDeliveredAt(null);
      setOtherTyping(false);
      setOtherPresenceAt(null);
      return;
    }
    const receiptRef = doc(db, 'conversations', selectedId, 'readReceipts', otherUid);
    const deliveryRef = doc(db, 'conversations', selectedId, 'deliveryReceipts', otherUid);
    const typingRef = doc(db, 'conversations', selectedId, 'typing', otherUid);
    const presenceRef = doc(db, 'conversations', selectedId, 'presence', otherUid);
    const stopReceipt = onSnapshot(receiptRef, snapshot => {
      setOtherReadAt(snapshot.exists() ? snapshot.get('lastReadAt') ?? null : null);
    });
    const stopDelivery = onSnapshot(deliveryRef, snapshot => {
      setOtherDeliveredAt(snapshot.exists() ? snapshot.get('lastDeliveredAt') ?? null : null);
    });
    const stopPresence = onSnapshot(presenceRef, snapshot => {
      setOtherPresenceAt(snapshot.exists() ? snapshot.get('lastSeenAt') ?? null : null);
    });
    const stopTyping = onSnapshot(typingRef, snapshot => {
      const active = snapshot.exists() && snapshot.get('isTyping') === true;
      setOtherTyping(active);
      if (otherTypingTimeoutRef.current) clearTimeout(otherTypingTimeoutRef.current);
      if (active) {
        otherTypingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 8500);
      }
    });
    return () => {
      stopReceipt();
      stopDelivery();
      stopPresence();
      stopTyping();
      if (otherTypingTimeoutRef.current) clearTimeout(otherTypingTimeoutRef.current);
    };
  }, [selectedId, otherUid]);

  useEffect(() => {
    const latestIncoming = [...messages].reverse().find(message => message.senderUid !== user.uid);
    const messageId = latestIncoming?.id;
    const receiptKey = messageId ? `${selectedId}:${messageId}` : '';
    if (!selectedId || !messageId || lastDeliveredMessageRef.current === receiptKey) return;
    lastDeliveredMessageRef.current = receiptKey;
    setDoc(doc(db, 'conversations', selectedId, 'deliveryReceipts', user.uid), {
      uid: user.uid,
      lastDeliveredAt: serverTimestamp(),
      lastDeliveredMessageId: messageId
    }, { merge: true }).catch(() => {
      lastDeliveredMessageRef.current = '';
    });
  }, [messages, selectedId, user.uid]);

  useEffect(() => {
    if (!selectedId) return;
    const ownPresenceRef = doc(db, 'conversations', selectedId, 'presence', user.uid);
    const heartbeat = () => setDoc(ownPresenceRef, {
      uid: user.uid,
      isOnline: true,
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(() => {});
    heartbeat();
    const heartbeatTimer = setInterval(heartbeat, 45_000);
    const displayTimer = setInterval(() => setPresenceNow(Date.now()), 15_000);
    return () => {
      clearInterval(heartbeatTimer);
      clearInterval(displayTimer);
    };
  }, [selectedId, user.uid]);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const receiptKey = lastMessage?.id ? `${selectedId}:${lastMessage.id}` : '';
    if (!selectedId || !pageVisible || !receiptKey || lastReadMessageRef.current === receiptKey) return;
    lastReadMessageRef.current = receiptKey;
    setDoc(doc(db, 'conversations', selectedId, 'readReceipts', user.uid), {
      uid: user.uid,
      lastReadAt: serverTimestamp(),
      lastReadMessageId: lastMessage.id
    }, { merge: true }).catch(() => {
      lastReadMessageRef.current = '';
    });
  }, [messages, selectedId, user.uid, pageVisible]);

  useEffect(() => {
    if (!selectedId) return;
    const typingRef = doc(db, 'conversations', selectedId, 'typing', user.uid);
    if (!draft.trim()) {
      lastTypingSentAtRef.current = 0;
      setDoc(typingRef, { uid: user.uid, isTyping: false, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
      return;
    }
    const now = Date.now();
    if (now - lastTypingSentAtRef.current >= 4000) {
      lastTypingSentAtRef.current = now;
      setDoc(typingRef, { uid: user.uid, isTyping: true, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
    }
    const stopTimer = setTimeout(() => {
      setDoc(typingRef, { uid: user.uid, isTyping: false, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
      lastTypingSentAtRef.current = 0;
    }, 8000);
    return () => clearTimeout(stopTimer);
  }, [draft, selectedId, user.uid]);


  async function loadOlderMessages() {
    const oldest = messages[0];
    if (!selectedId || !oldest?.createdAt || loadingOlder || !hasMoreMessages) return;
    setLoadingOlder(true);
    try {
      const olderQuery = query(
        collection(db, 'conversations', selectedId, 'messages'),
        orderBy('createdAt', 'desc'),
        orderBy(documentId(), 'desc'),
        startAfter(oldest.createdAt, oldest.id),
        limit(50)
      );
      const snapshot = await getDocs(olderQuery);
      const older = snapshot.docs.map(item => ({
        id: item.id,
        senderUid: item.get('senderUid') ?? '',
        type: item.get('type') ?? 'text',
        text: item.get('text') ?? '',
        createdAt: item.get('createdAt') ?? null,
        mediaPath: item.get('mediaPath') ?? undefined,
        contentType: item.get('contentType') ?? undefined,
        fileName: item.get('fileName') ?? undefined
      })).reverse();
      setMessages(current => {
        const known = new Set(current.map(message => message.id));
        return [...older.filter(message => !known.has(message.id)), ...current];
      });
      setHasMoreMessages(snapshot.size === 50);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر تحميل الرسائل الأقدم.');
    } finally {
      setLoadingOlder(false);
    }
  }

  useEffect(() => {
    let active = true;
    const mediaMessages = messages.filter(message => message.mediaPath && mediaUrls[message.id] === undefined);
    if (!mediaMessages.length) return;
    Promise.all(mediaMessages.map(async message => {
      try {
        return [message.id, await getDownloadURL(storageRef(storage, message.mediaPath!))] as const;
      } catch {
        return [message.id, null] as const;
      }
    })).then(entries => {
      if (!active) return;
      setMediaUrls(current => ({ ...current, ...Object.fromEntries(entries) }));
    });
    return () => { active = false; };
  }, [messages, mediaUrls]);

  async function publishProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = profileName.trim();
    const city = profileCity.trim();
    if (name.length < 2 || name.length > 60) { setError('الاسم يجب أن يكون بين حرفين و60 حرفاً.'); return; }
    if (city.length > 80) { setError('اسم المدينة طويل جداً.'); return; }
    setProfileSaving(true);
    setError('');
    try {
      const updatedAt = serverTimestamp();
      await setDoc(doc(db, 'users', user.uid), {
        displayName: name,
        city,
        updatedAt
      }, { merge: true });
      await setDoc(doc(db, 'publicProfiles', user.uid), {
        uid: user.uid,
        displayName: name,
        city,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر نشر الملف الشخصي.');
    } finally {
      setProfileSaving(false);
    }
  }

  async function searchUsers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = searchTerm.trim();
    if (term.length < 2) { setError('اكتب حرفين على الأقل للبحث عن مستخدم.'); return; }
    setSearching(true);
    setError('');
    try {
      const q = query(
        collection(db, 'publicProfiles'),
        orderBy('displayName'),
        startAt(term),
        endAt(term + '\uf8ff'),
        limit(15)
      );
      const snapshot = await getDocs(q);
      setSearchResults(snapshot.docs
        .filter(item => item.id !== user.uid)
        .map(item => ({
          uid: item.id,
          displayName: item.get('displayName') ?? 'مستخدم IMI',
          city: item.get('city') ?? undefined,
          photoPath: item.get('photoPath') ?? undefined
        })));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر البحث عن المستخدمين.');
    } finally {
      setSearching(false);
    }
  }

  async function startConversation(otherUid: string) {
    if (!otherUid || otherUid === user.uid || busy) return;
    setBusy(true);
    setError('');
    try {
      const action = httpsCallable<{ otherUid: string }, { conversationId: string }>(
        getFunctions(), 'createOrGetDirectConversation'
      );
      const response = await action({ otherUid });
      if (!response.data.conversationId) throw new Error('لم يرجع الخادم معرّف المحادثة.');
      setSelectedId(response.data.conversationId);
      setSearchResults([]);
      setSearchTerm('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر إنشاء المحادثة.');
    } finally {
      setBusy(false);
    }
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (groupName.trim().length < 2 || groupMembers.length < 2 || busy) return;
    setBusy(true); setError('');
    try {
      const action = httpsCallable<{ name: string; participantUids: string[] }, { conversationId: string }>(getFunctions(), 'createGroupConversation');
      const response = await action({ name: groupName.trim(), participantUids: groupMembers });
      setSelectedId(response.data.conversationId);
      setGroupMembers([]); setGroupName(''); setSearchResults([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر إنشاء المجموعة. تأكد من أن الأعضاء أصدقاؤك.');
    } finally { setBusy(false); }
  }

  function toggleGroupMember(uid: string) {
    setGroupMembers(current => current.includes(uid) ? current.filter(value => value !== uid) : [...current, uid]);
  }

  async function addSelectedGroupMembers() {
    if (!selectedId || selected?.type !== 'group' || groupMembers.length === 0 || busy) return;
    setBusy(true); setError('');
    try {
      await httpsCallable(getFunctions(), 'addGroupParticipants')({ conversationId: selectedId, participantUids: groupMembers });
      setGroupMembers([]);
      setNotice('تمت إضافة الأعضاء إلى المجموعة.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذرت إضافة الأعضاء. يجب أن تكون صديقاً لكل عضو جديد ومشرفاً في المجموعة.');
    } finally { setBusy(false); }
  }

  async function unblock(uid: string) {
    try {
      await httpsCallable(getFunctions(), 'unblockUser')({ targetUid: uid });
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر إلغاء الحظر.');
    }
  }

  async function blockSelectedUser() {
    if (!otherUid || blockBusy) return;
    if (!window.confirm('هل تريد حظر هذا المستخدم؟ سيُوقف التواصل المباشر وتُحذف الصداقة المتبادلة.')) return;
    setBlockBusy(true); setError('');
    try {
      await httpsCallable(getFunctions(), 'blockUser')({ targetUid: otherUid });
      setSelectedId('');
      setMessages([]);
      setError('تم حظر المستخدم وإيقاف المحادثة المباشرة.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر حظر المستخدم.');
    } finally { setBlockBusy(false); }
  }

  async function toggleVoiceRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('تسجيل الصوت غير مدعوم في هذا المتصفح. يمكنك إرفاق ملف صوتي بدلاً من ذلك.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordingChunksRef.current = [];
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find(candidate => MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = event => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError('حدث خطأ أثناء تسجيل الصوت. تحقق من إذن الميكروفون.');
        setRecording(false);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm';
        const blob = new Blob(recordingChunksRef.current, { type });
        if (blob.size > 0) {
          const extension = type.includes('mp4') ? 'm4a' : 'webm';
          setAttachment(new File([blob], `voice-message-${Date.now()}.${extension}`, { type }));
        }
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setRecording(false);
      };
      recorder.start();
      setRecording(true);
      setError('');
    } catch {
      mediaStreamRef.current?.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
      setError('تعذر الوصول إلى الميكروفون. اسمح للموقع باستخدام الميكروفون ثم حاول مجدداً.');
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!selectedId || (!text && !attachment) || busy) return;
    if (text.length > 1000) { setError('الرسالة أطول من 1000 حرف.'); return; }
    if (attachment) {
      const type = attachment.type;
      const category = type.startsWith('image/') ? 'image' : type.startsWith('audio/') ? 'audio' : type.startsWith('video/') ? 'video' : '';
      const allowed = category === 'image'
        ? ['image/jpeg', 'image/png', 'image/webp'].includes(type) && attachment.size <= 10 * 1024 * 1024
        : category === 'audio'
          ? ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm'].includes(type) && attachment.size <= 20 * 1024 * 1024
          : category === 'video'
            ? ['video/mp4', 'video/webm'].includes(type) && attachment.size <= 50 * 1024 * 1024
            : false;
      if (!allowed) { setError('نوع الملف غير مدعوم أو حجمه يتجاوز الحد المسموح. الصور 10MB، الصوت 20MB، الفيديو 50MB.'); return; }
    }
    setBusy(true);
    setError('');
    let uploadedMediaPath: string | undefined;
    try {
      const conversationRef = doc(db, 'conversations', selectedId);
      const messageRef = doc(collection(conversationRef, 'messages'));
      let mediaPath: string | undefined;
      let type: 'text' | 'image' | 'audio' | 'video' = 'text';
      if (attachment) {
        type = attachment.type.startsWith('image/') ? 'image' : attachment.type.startsWith('audio/') ? 'audio' : 'video';
        mediaPath = `conversations/${selectedId}/${user.uid}/${messageRef.id}/${attachment.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)}`;
        uploadedMediaPath = mediaPath;
        await uploadBytes(storageRef(storage, mediaPath), attachment, {
          contentType: attachment.type,
          customMetadata: { ownerUid: user.uid, conversationId: selectedId, messageId: messageRef.id }
        });
      }
      const preview = attachment ? (type === 'image' ? '📷 صورة' : type === 'audio' ? '🎤 رسالة صوتية' : '🎬 فيديو') : text;
      const batch = writeBatch(db);
      batch.set(messageRef, {
        senderUid: user.uid,
        type,
        ...(text ? { text } : {}),
        ...(mediaPath ? { mediaPath, contentType: attachment!.type, fileName: attachment!.name.slice(0, 120) } : {}),
        createdAt: serverTimestamp()
      });
      batch.update(conversationRef, {
        lastMessage: text || preview,
        lastMessageId: messageRef.id,
        lastMessageAt: serverTimestamp(),
        lastSenderUid: user.uid
      });
      await batch.commit();
      setDraft('');
      setAttachment(null);
    } catch (reason) {
      if (uploadedMediaPath) {
        await deleteObject(storageRef(storage, uploadedMediaPath)).catch(() => {});
      }
      setError(reason instanceof Error ? reason.message : 'تعذر إرسال الرسالة أو رفع الملف.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="grid min-h-[520px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 md:grid-cols-[minmax(220px,0.8fr)_1.5fr]" dir="rtl">
    <aside className="border-b border-white/10 p-3 md:border-b-0 md:border-l">
      <div className="mb-3 flex items-center justify-between"><h3 className="font-bold">محادثاتي</h3><span className="text-xs text-slate-500">{chats.length}</span></div>
      <details className="mb-3 rounded-xl border border-white/10 bg-white/[.025] p-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-300">ملفي في دليل IMI</summary>
        <form onSubmit={publishProfile} className="mt-3 space-y-2">
          <input value={profileName} onChange={event => setProfileName(event.target.value)} maxLength={60} disabled={!profileReady} aria-label="الاسم الظاهر" placeholder="اسمك الظاهر" className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          <input value={profileCity} onChange={event => setProfileCity(event.target.value)} maxLength={80} disabled={!profileReady} aria-label="المدينة" placeholder="المدينة" className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          <button disabled={!profileReady || profileSaving} className="w-full rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold disabled:opacity-40">{profileSaving ? 'جارٍ النشر…' : 'حفظ ونشر اسمي للبحث'}</button>
          <p className="text-[10px] leading-5 text-slate-500">سيظهر اسمك ومدينتك للمستخدمين المسجلين في دليل IMI.</p>
        </form>
      </details>
      <form onSubmit={searchUsers} className="mb-3 space-y-2">
        <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="ابحث بالاسم…" className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500" />
        <button disabled={searching || searchTerm.trim().length < 2} className="w-full rounded-xl border border-blue-500/30 px-3 py-2 text-xs font-semibold text-blue-200 disabled:opacity-40">{searching ? 'جارٍ البحث…' : 'بحث عن مستخدمين'}</button>
      </form>
      {groupMembers.length > 0 && <div className="mb-3 space-y-2 rounded-xl border border-violet-400/20 bg-violet-500/5 p-3">
        <p className="text-xs text-violet-200">أعضاء مختارون: {groupMembers.length}</p>
        {selected?.type === 'group' ? <button type="button" onClick={addSelectedGroupMembers} disabled={busy} className="w-full rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold disabled:opacity-40">إضافة إلى المجموعة الحالية</button> : <form onSubmit={createGroup} className="space-y-2">
          <input value={groupName} onChange={event => setGroupName(event.target.value)} placeholder="اسم المجموعة" minLength={2} maxLength={80} className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm" />
          <button disabled={busy || groupMembers.length < 2 || groupName.trim().length < 2} className="w-full rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold disabled:opacity-40">إنشاء مجموعة (3 أعضاء على الأقل)</button>
        </form>}
      </div>}
      {blockedUsers.length > 0 && <div className="mb-3 rounded-xl border border-red-400/20 bg-red-500/5 p-3"><p className="mb-2 text-xs font-bold text-red-200">الحسابات المحظورة</p>{blockedUsers.map(uid=><div key={uid} className="flex items-center justify-between gap-2 py-1"><span className="text-xs text-slate-300">{uid.slice(0,12)}</span><button type="button" onClick={()=>unblock(uid)} className="rounded border border-white/10 px-2 py-1 text-[10px]">إلغاء الحظر</button></div>)}</div>}
      {searchResults.length > 0 && <div className="mb-3 space-y-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-2">
        <p className="px-2 text-xs text-slate-400">نتائج البحث</p>
        {searchResults.map(profile => <div key={profile.uid} className="flex items-center justify-between gap-2 rounded-lg bg-white/[.04] p-2">
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{profile.displayName}</p><p className="truncate text-[10px] text-slate-500">{profile.city || profile.uid.slice(0, 8)}</p></div>
          <div className="flex shrink-0 gap-1"><button type="button" onClick={() => toggleGroupMember(profile.uid)} className={'rounded-lg border px-2 py-2 text-[10px] '+(groupMembers.includes(profile.uid)?'border-violet-400 bg-violet-500/20 text-violet-200':'border-white/10 text-slate-300')}>{groupMembers.includes(profile.uid)?'أُضيف':'للمجموعة'}</button><button type="button" onClick={() => startConversation(profile.uid)} disabled={busy} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold disabled:opacity-40">مراسلة</button></div>
        </div>)}
      </div>}
      {loadingChats ? <p className="p-4 text-sm text-slate-400">جارٍ تحميل المحادثات…</p> : chats.length === 0 ? <p className="rounded-xl bg-white/[.04] p-4 text-sm leading-7 text-slate-400">لا توجد محادثات مرتبطة بهذا الحساب بعد. عندما تبدأ محادثة من تطبيق IMI ستظهر هنا.</p> :
        <div className="space-y-2">{chats.map(chat => {
          const other = chat.participants.find(uid => uid !== user.uid);
          return <button key={chat.id} onClick={() => setSelectedId(chat.id)} className={`w-full rounded-xl p-3 text-right ${selectedId === chat.id ? 'bg-blue-600/20 ring-1 ring-blue-500/50' : 'bg-white/[.035] hover:bg-white/[.07]'}`}>
            <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{chat.type === 'group' ? (chat.name || 'مجموعة IMI') : (other ? `مستخدم ${other.slice(0, 8)}` : 'محادثة')}</span><span className="shrink-0 text-[10px] text-slate-500">{timeLabel(chat.lastMessageAt)}</span></div>
            <p className="mt-2 truncate text-xs text-slate-400">{chat.lastMessage || 'ابدأ المحادثة'}</p>
          </button>;
        })}</div>}
    </aside>
    <div className="flex min-h-[420px] flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3"><div><h3 className="font-bold">{selected?.type === 'group' ? (selected.name || 'مجموعة IMI') : (selected ? 'المحادثة' : 'الرسائل')}</h3><p className="mt-1 text-xs text-slate-500">{selected ? selected.id : 'اختر محادثة من القائمة'}</p>{otherTyping && <p className="mt-1 text-xs text-emerald-300" aria-live="polite">يكتب الآن…</p>}{otherPresenceAt && <p className="mt-1 text-[11px] text-slate-400">{presenceNow - otherPresenceAt.toMillis() < 90_000 ? 'نشط الآن في هذه المحادثة' : `آخر نشاط في المحادثة: ${timeLabel(otherPresenceAt)}`}</p>}</div>{selected && selected.type !== 'group' && otherUid && <button type="button" onClick={blockSelectedUser} disabled={blockBusy} className="rounded-lg border border-red-400/25 px-3 py-2 text-xs text-red-200 disabled:opacity-40">{blockBusy?'جارٍ الحظر…':'حظر المستخدم'}</button>}</header>
      {selected?.type !== 'group' && <CallControls user={user} conversationId={selectedId || undefined} calleeUid={otherUid || undefined} />}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {selectedId && hasMoreMessages && <button type="button" onClick={loadOlderMessages} disabled={loadingOlder || loadingMessages} className="mx-auto block rounded-lg border border-white/10 px-4 py-2 text-xs text-slate-300 disabled:opacity-50">{loadingOlder ? 'جارٍ تحميل الأقدم…' : 'تحميل رسائل أقدم'}</button>}
        {!selectedId && <p className="py-16 text-center text-sm text-slate-500">لا توجد محادثة محددة.</p>}
        {selectedId && loadingMessages && <p className="text-sm text-slate-400">جارٍ تحميل الرسائل…</p>}
        {selectedId && !loadingMessages && messages.length === 0 && <p className="py-16 text-center text-sm text-slate-500">لا توجد رسائل بعد. أرسل أول رسالة.</p>}
        {messages.map(message => <div key={message.id} className={`flex ${message.senderUid === user.uid ? 'justify-start' : 'justify-end'}`}><article className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.senderUid === user.uid ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-100'}`}>{message.type === 'image' && mediaUrls[message.id] && <a href={mediaUrls[message.id] || undefined} target="_blank" rel="noreferrer"><img src={mediaUrls[message.id] || undefined} alt={message.fileName || 'صورة مرفقة'} className="mb-2 max-h-72 max-w-full rounded-xl object-contain" /></a>}{message.type === 'video' && mediaUrls[message.id] && <video src={mediaUrls[message.id] || undefined} controls playsInline className="mb-2 max-h-72 max-w-full rounded-xl" />}{message.type === 'audio' && mediaUrls[message.id] && <audio src={mediaUrls[message.id] || undefined} controls className="mb-2 max-w-full" />}{message.mediaPath && mediaUrls[message.id] === undefined && <p className="mb-2 text-xs opacity-70">جارٍ تحميل المرفق…</p>}{message.mediaPath && mediaUrls[message.id] === null && <p className="mb-2 text-xs opacity-70">تعذر تحميل المرفق.</p>}{message.text && <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>}<time className="mt-2 block text-left text-[10px] opacity-60">{timeLabel(message.createdAt)}{message.senderUid === user.uid ? (otherReadAt && message.createdAt && otherReadAt.toMillis() >= message.createdAt.toMillis() ? ' · تمت القراءة' : otherDeliveredAt && message.createdAt && otherDeliveredAt.toMillis() >= message.createdAt.toMillis() ? ' · تم التسليم' : ' · تم الإرسال') : ''}</time></article></div>)}
      </div>
      <form onSubmit={send} className="border-t border-white/10 p-3"><div className="mb-2 flex items-center gap-2"><label className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">إرفاق ملف<input type="file" accept="image/jpeg,image/png,image/webp,audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav,audio/webm,video/mp4,video/webm" disabled={!selectedId || busy || recording} className="hidden" onChange={event => setAttachment(event.target.files?.[0] ?? null)} /></label><button type="button" onClick={toggleVoiceRecording} disabled={!selectedId || busy} className={`rounded-lg border px-3 py-2 text-xs ${recording ? 'border-rose-500/50 text-rose-300' : 'border-white/10 text-slate-300'}`}>{recording ? 'إيقاف التسجيل' : 'تسجيل صوت'}</button>{attachment && <span className="min-w-0 flex-1 truncate text-xs text-slate-400">{attachment.name} · {(attachment.size / (1024 * 1024)).toFixed(1)} MB</span>}{attachment && <button type="button" onClick={() => setAttachment(null)} className="text-xs text-rose-300">إزالة</button>}</div><div className="flex gap-2"><input value={draft} onChange={event => setDraft(event.target.value)} maxLength={1000} disabled={!selectedId || busy} placeholder="اكتب رسالتك…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-blue-500 disabled:opacity-50" /><button disabled={!selectedId || (!draft.trim() && !attachment) || busy} className="rounded-xl bg-blue-600 px-5 text-sm font-bold disabled:opacity-40">{busy ? '…' : 'إرسال'}</button></div></form>
    </div>
    {error && <p role="alert" className="col-span-full border-t border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-6 text-amber-200">تعذر تحميل البيانات أو تنفيذ العملية: {error}. قد يتطلب الاستعلام فهرس Firestore أو صلاحيات مناسبة.</p>}
  </section>;
}
