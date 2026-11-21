'use client';

import { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  addDoc, collection, doc, getDoc, limit, onSnapshot, query, updateDoc, where, Timestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase/client';

type CallKind = 'audio' | 'video';
type IncomingCall = {
  id: string;
  callerUid: string;
  conversationId: string;
  kind: CallKind;
  expiresAt: Timestamp | null;
};

type CallSessionRole = 'caller' | 'callee';

export default function CallControls({
  user,
  conversationId,
  calleeUid
}: {
  user: User;
  conversationId?: string;
  calleeUid?: string;
}) {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCallId, setActiveCallId] = useState('');
  const [activeKind, setActiveKind] = useState<CallKind>('audio');
  const [callStatus, setCallStatus] = useState('');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [turnConfigured, setTurnConfigured] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState('غير متاح');
  const [connectionPath, setConnectionPath] = useState('unknown');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const unsubsRef = useRef<Array<() => void>>([]);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const activeCallIdRef = useRef('');
  const answerStartedRef = useRef(false);
  const retryCountRef = useRef(0);
  const lastOfferSdpRef = useRef('');
  const lastAnswerSdpRef = useRef('');

  const createCall = httpsCallable<{ conversationId: string; calleeUid: string; kind: CallKind }, { callId: string }>(functions, 'createCall');
  const respondToCall = httpsCallable<{ callId: string; decision: 'accepted' | 'rejected' }, { status: string }>(functions, 'respondToCall');
  const endCallAction = httpsCallable<{ callId: string }, { status: string }>(functions, 'endCall');
  const getIceServers = httpsCallable<Record<string, never>, { turnAvailable: boolean; iceServers: RTCIceServer[]; expiresAt: number | null }>(functions, 'getIceServers');
  const restartCallIce = httpsCallable<{ callId: string; sdp: string }, { offerRevision: number }>(functions, 'restartCallIce');

  function cleanupSession() {
    unsubsRef.current.forEach(unsubscribe => unsubscribe());
    unsubsRef.current = [];
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    pendingCandidatesRef.current = [];
    answerStartedRef.current = false;
    retryCountRef.current = 0;
    lastOfferSdpRef.current = '';
    lastAnswerSdpRef.current = '';
    setConnectionQuality('غير متاح');
    setConnectionPath('unknown');
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    activeCallIdRef.current = '';
    setActiveCallId('');
    setCallStatus('');
    setMuted(false);
    setCameraOff(false);
    setBusy(false);
  }

  useEffect(() => {
    const incomingQuery = query(
      collection(db, 'calls'),
      where('calleeUid', '==', user.uid),
      where('status', '==', 'ringing'),
      where('expiresAt', '>', Timestamp.now()),
      limit(10)
    );
    return onSnapshot(incomingQuery, snapshot => {
      const now = Date.now();
      const candidate = snapshot.docs
        .map(item => ({
          id: item.id,
          callerUid: item.get('callerUid') ?? '',
          conversationId: item.get('conversationId') ?? '',
          kind: item.get('kind') as CallKind,
          expiresAt: item.get('expiresAt') ?? null,
          status: item.get('status') ?? ''
        }))
        .filter(item => item.expiresAt instanceof Timestamp && item.expiresAt.toMillis() > now)
        .sort((a, b) => (b.expiresAt?.toMillis() ?? 0) - (a.expiresAt?.toMillis() ?? 0))[0];
      setIncomingCall(candidate ? {
        id: candidate.id,
        callerUid: candidate.callerUid,
        conversationId: candidate.conversationId,
        kind: candidate.kind,
        expiresAt: candidate.expiresAt
      } : null);
    }, reason => setError(reason.message));
  }, [user.uid]);

  async function flushPendingCandidates(peer: RTCPeerConnection) {
    const pending = pendingCandidatesRef.current.splice(0);
    for (const candidate of pending) {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  async function createPeer(callId: string, role: CallSessionRole, kind: CallKind) {
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      throw new Error('المتصفح لا يدعم المكالمات أو لا يوفر إذن الميكروفون والكاميرا.');
    }
    const stunUrls = (process.env.NEXT_PUBLIC_STUN_URLS || 'stun:stun.l.google.com:19302')
      .split(',')
      .map(value => value.trim())
      .filter(value => value.startsWith('stun:') || value.startsWith('stuns:'));
    let iceServers: RTCIceServer[] = [{ urls: stunUrls.length ? stunUrls : ['stun:stun.l.google.com:19302'] }];
    let iceTransportPolicy: RTCIceTransportPolicy =
      process.env.NEXT_PUBLIC_ICE_TRANSPORT_POLICY === 'relay' ? 'relay' : 'all';
    try {
      const iceResult = await getIceServers({});
      iceServers = iceResult.data.iceServers;
      setTurnConfigured(iceResult.data.turnAvailable);
      if (!iceResult.data.turnAvailable) {
        // Relay-only with STUN-only servers would prevent all ICE candidates.
        iceTransportPolicy = 'all';
        setError('خادم TURN غير مهيأ؛ سيُستخدم STUN فقط، وقد يفشل الاتصال بين بعض الشبكات.');
      }
    } catch {
      setTurnConfigured(false);
      iceTransportPolicy = 'all';
      setError('تعذّر جلب إعدادات الاتصال؛ سيُستخدم STUN فقط. إذا تعذّر الاتصال، جرّب شبكة أخرى.');
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: kind === 'video' ? { facingMode: 'user' } : false
    });
    localStreamRef.current = stream;
    if (localVideoRef.current && kind === 'video') {
      localVideoRef.current.srcObject = stream;
      await localVideoRef.current.play().catch(() => {});
    }

    const peer = new RTCPeerConnection({ iceServers, iceTransportPolicy });
    peerRef.current = peer;
    stream.getTracks().forEach(track => peer.addTrack(track, stream));
    peer.ontrack = event => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        void remoteVideoRef.current.play().catch(() => {});
      }
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') setCallStatus('connected');
      else if (peer.connectionState === 'disconnected') setCallStatus('reconnecting');
      else if (peer.connectionState === 'failed') {
        setCallStatus('reconnecting');
        if (role !== 'caller' || retryCountRef.current >= 2) {
          setError('تعذّر الاتصال، جرّب شبكة أخرى');
        }
      }
    };
    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === 'failed' && role === 'caller' && retryCountRef.current < 2) {
        retryCountRef.current += 1;
        setCallStatus('reconnecting');
        void (async () => {
          peer.restartIce();
          const retryOffer = await peer.createOffer({ iceRestart: true });
          await peer.setLocalDescription(retryOffer);
          lastOfferSdpRef.current = retryOffer.sdp ?? '';
          await restartCallIce({ callId, sdp: retryOffer.sdp ?? '' });
        })().catch(() => setError('تعذّر الاتصال، جرّب شبكة أخرى'));
      } else if (peer.iceConnectionState === 'failed') {
        setError('تعذّر الاتصال، جرّب شبكة أخرى');
      }
    };
    peer.onicecandidate = event => {
      if (!event.candidate) return;
      const ownSide = role === 'caller' ? 'callerCandidates' : 'calleeCandidates';
      const candidate = event.candidate.toJSON();
      const candidateText = event.candidate.candidate;
      if (!candidateText) return;
      const payload: Record<string, string | number> = { candidate: candidateText };
      if (candidate.sdpMid) payload.sdpMid = candidate.sdpMid;
      if (typeof candidate.sdpMLineIndex === 'number') payload.sdpMLineIndex = candidate.sdpMLineIndex;
      void addDoc(collection(db, 'calls', callId, ownSide), payload).catch(reason => {
        setError(reason instanceof Error ? reason.message : 'تعذر إرسال بيانات الاتصال.');
      });
    };

    const remoteSide = role === 'caller' ? 'calleeCandidates' : 'callerCandidates';
    const remoteCandidates = query(collection(db, 'calls', callId, remoteSide));
    const stopCandidates = onSnapshot(remoteCandidates, snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type !== 'added') return;
        const data = change.doc.data();
        const candidate: RTCIceCandidateInit = {
          candidate: data.candidate,
          sdpMid: data.sdpMid ?? null,
          sdpMLineIndex: data.sdpMLineIndex ?? null
        };
        if (peer.remoteDescription) {
          void peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(reason => {
            setError(reason instanceof Error ? reason.message : 'تعذر استقبال مسار الاتصال.');
          });
        } else {
          pendingCandidatesRef.current.push(candidate);
        }
      });
    });
    unsubsRef.current.push(stopCandidates);

    const stopCall = onSnapshot(doc(db, 'calls', callId), snapshot => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      setCallStatus(data.status ?? 'connecting');
      if (['rejected', 'ended', 'missed'].includes(data.status)) {
        if (data.status === 'rejected') setError('رفض الطرف الآخر المكالمة.');
        if (data.status === 'missed') setError('انتهت مهلة الرد على المكالمة.');
        cleanupSession();
        return;
      }
      if (role === 'caller' && data.answer && data.answerRevision === data.offerRevision && data.answer.sdp !== lastAnswerSdpRef.current) {
        lastAnswerSdpRef.current = data.answer.sdp ?? '';
        void peer.setRemoteDescription(new RTCSessionDescription(data.answer))
          .then(() => flushPendingCandidates(peer))
          .catch(reason => setError(reason instanceof Error ? reason.message : 'تعذر استقبال إجابة المكالمة.'));
      }
      if (role === 'callee' && data.offer && data.offer.sdp !== lastOfferSdpRef.current) {
        lastOfferSdpRef.current = data.offer.sdp ?? '';
        answerStartedRef.current = true;
        void (async () => {
          await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
          await flushPendingCandidates(peer);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          lastAnswerSdpRef.current = answer.sdp ?? '';
          await updateDoc(doc(db, 'calls', callId), {
            answer: { type: answer.type, sdp: answer.sdp },
            answerRevision: typeof data.offerRevision === 'number' ? data.offerRevision : 0
          });
        })().catch(reason => {
          setError(reason instanceof Error ? reason.message : 'تعذر إنشاء إجابة المكالمة.');
          void endCallAction({ callId }).catch(() => {});
          cleanupSession();
        });
      }
    }, reason => setError(reason.message));
    unsubsRef.current.push(stopCall);
  }

  async function startCall(kind: CallKind) {
    if (!conversationId || !calleeUid || busy || activeCallIdRef.current) return;
    setBusy(true);
    setError('');
    try {
      const result = await createCall({ conversationId, calleeUid, kind });
      const callId = result.data.callId;
      activeCallIdRef.current = callId;
      setActiveCallId(callId);
      setActiveKind(kind);
      setCallStatus('ringing');
      await createPeer(callId, 'caller', kind);
      const peer = peerRef.current;
      if (!peer) throw new Error('تعذر إنشاء اتصال WebRTC.');
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      lastOfferSdpRef.current = offer.sdp ?? '';
      await updateDoc(doc(db, 'calls', callId), {
        offer: { type: offer.type, sdp: offer.sdp }
      });
      setBusy(false);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'تعذر بدء المكالمة.';
      setError(message);
      const callId = activeCallIdRef.current;
      if (callId) await endCallAction({ callId }).catch(() => {});
      cleanupSession();
    }
  }

  async function answerCall(decision: 'accepted' | 'rejected') {
    if (!incomingCall || busy) return;
    const call = incomingCall;
    setBusy(true);
    setError('');
    try {
      await respondToCall({ callId: call.id, decision });
      setIncomingCall(null);
      if (decision === 'rejected') {
        setBusy(false);
        return;
      }
      activeCallIdRef.current = call.id;
      setActiveCallId(call.id);
      setActiveKind(call.kind);
      setCallStatus('connecting');
      await createPeer(call.id, 'callee', call.kind);
      setBusy(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر الرد على المكالمة.');
      await endCallAction({ callId: call.id }).catch(() => {});
      cleanupSession();
      setIncomingCall(null);
      setBusy(false);
    }
  }

  async function endCall() {
    const callId = activeCallIdRef.current;
    if (callId) await endCallAction({ callId }).catch(reason => {
      setError(reason instanceof Error ? reason.message : 'تعذر إنهاء المكالمة من الخادم.');
    });
    cleanupSession();
  }

  function toggleMute() {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = !next; });
    setMuted(next);
  }

  function toggleCamera() {
    const next = !cameraOff;
    localStreamRef.current?.getVideoTracks().forEach(track => { track.enabled = !next; });
    setCameraOff(next);
  }

  useEffect(() => {
    if (!activeCallId || !peerRef.current) return;
    let stopped = false;
    const inspect = async () => {
      const peer = peerRef.current;
      if (!peer || stopped) return;
      try {
        const stats = await peer.getStats();
        let selected: RTCIceCandidatePairStats | undefined;
        stats.forEach(report => {
          const pair = report as RTCIceCandidatePairStats;
          if (report.type === 'candidate-pair' && pair.state === 'succeeded' && pair.nominated) selected = pair;
        });
        if (!selected) return;
        const local = stats.get(selected.localCandidateId) as (RTCStats & { candidateType?: string }) | undefined;
        const remote = stats.get(selected.remoteCandidateId) as (RTCStats & { candidateType?: string }) | undefined;
        const rttMs = (selected.currentRoundTripTime ?? 0) * 1000;
        const quality = rttMs <= 150 ? 'جيد' : rttMs <= 300 ? 'متوسط' : 'ضعيف';
        const path = local?.candidateType === 'relay' || remote?.candidateType === 'relay' ? 'relay' : 'direct';
        if (!stopped) {
          setConnectionQuality(quality);
          setConnectionPath(path);
        }
      } catch {
        if (!stopped) setConnectionQuality('غير متاح');
      }
    };
    void inspect();
    const timer = window.setInterval(() => void inspect(), 2500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [activeCallId, callStatus]);

  useEffect(() => () => {
    const callId = activeCallIdRef.current;
    if (callId) {
      void httpsCallable<{ callId: string }, { status: string }>(functions, 'endCall')({ callId }).catch(() => {});
    }
    cleanupSession();
  }, []);

  return <>
    <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2">
      <span className="text-xs text-slate-500">مكالمات WebRTC</span>
      <button type="button" onClick={() => startCall('audio')} disabled={!conversationId || !calleeUid || busy || !!activeCallId} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 disabled:opacity-40">مكالمة صوتية</button>
      <button type="button" onClick={() => startCall('video')} disabled={!conversationId || !calleeUid || busy || !!activeCallId} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 disabled:opacity-40">مكالمة فيديو</button>
      {activeCallId && <span className="text-xs text-blue-300">{callStatus === 'connected' ? 'متصل' : callStatus === 'reconnecting' ? 'إعادة الاتصال…' : 'جارٍ الاتصال…'}</span>}
      {error && <span role="alert" className="w-full text-xs text-amber-300">{error}</span>}
    </div>

    {incomingCall && !activeCallId && <div className="fixed inset-x-3 top-4 z-40 mx-auto max-w-md rounded-2xl border border-blue-400/30 bg-slate-950 p-4 shadow-2xl">
      <p className="font-bold">مكالمة واردة</p>
      <p className="mt-1 text-sm text-slate-300">{incomingCall.kind === 'video' ? 'مكالمة فيديو' : 'مكالمة صوتية'} من مستخدم {incomingCall.callerUid.slice(0, 8)}</p>
      <div className="mt-3 flex gap-2"><button type="button" onClick={() => answerCall('accepted')} disabled={busy} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold disabled:opacity-40">قبول</button><button type="button" onClick={() => answerCall('rejected')} disabled={busy} className="flex-1 rounded-lg bg-rose-700 px-3 py-2 text-sm font-bold disabled:opacity-40">رفض</button></div>
    </div>}

    {activeCallId && <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 p-4" dir="rtl">
      <header className="flex items-center justify-between"><div><h2 className="font-bold">{activeKind === 'video' ? 'مكالمة فيديو' : 'مكالمة صوتية'}</h2><p className="text-xs text-slate-400">{callStatus === 'connected' ? 'تم الاتصال' : callStatus === 'reconnecting' ? 'محاولة إعادة الاتصال' : 'جارٍ إنشاء الاتصال'} · جودة الاتصال: {connectionQuality}</p><p className="text-[10px] text-slate-500">{process.env.NODE_ENV !== 'production' ? `مسار ICE: ${connectionPath}` : ''}</p></div><button type="button" onClick={endCall} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold">إنهاء</button></header>
      <div className="relative mt-4 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black">
        <video ref={remoteVideoRef} autoPlay playsInline className="h-full max-h-full w-full object-contain" />
        {activeKind === 'video' && <video ref={localVideoRef} autoPlay muted playsInline className="absolute bottom-4 left-4 max-h-36 w-28 rounded-xl border border-white/20 object-cover" />}
        {activeKind === 'audio' && <div className="absolute text-5xl" aria-hidden="true">🎧</div>}
      </div>
      <div className="flex justify-center gap-3 py-4"><button type="button" onClick={toggleMute} className="rounded-xl border border-white/15 px-4 py-3 text-sm">{muted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}</button>{activeKind === 'video' && <button type="button" onClick={toggleCamera} className="rounded-xl border border-white/15 px-4 py-3 text-sm">{cameraOff ? 'تشغيل الكاميرا' : 'إيقاف الكاميرا'}</button>}<button type="button" onClick={endCall} className="rounded-xl bg-rose-700 px-5 py-3 text-sm font-bold">إنهاء المكالمة</button></div>
      <p className="text-center text-[10px] text-slate-500">{turnConfigured ? 'خادم Coturn الداخلي مهيأ؛ جودة الاتصال تعتمد على إتاحته وشبكة الطرفين.' : 'Coturn الداخلي غير مهيأ؛ لا يستخدم IMI خوادم STUN خارجية، وقد تقتصر المكالمات على الاتصال المباشر.'}</p>
    </div>}
  </>;
}
