'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Socket } from 'socket.io-client';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { useAppRealtime } from './AppRealtimeSocketContext';

export type VoicePeer = {
  id: string;
  name: string;
  avatar: string | null;
  username: string;
};

type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ended';

type CallStartAck =
  | {
      ok: true;
      sessionId: string;
      conversationId: string;
      callType: string;
      peer: VoicePeer;
    }
  | { ok: false; code: string; message?: string };

type VoiceCallContextValue = {
  phase: CallPhase;
  peer: VoicePeer | null;
  muted: boolean;
  elapsedSeconds: number;
  endedReason: string | null;
  startCall: (opts: { conversationId?: string; targetUserId?: string }) => void;
  acceptIncoming: () => void;
  rejectIncoming: () => void;
  hangup: () => void;
  toggleMute: () => void;
};

const VoiceCallContext = createContext<VoiceCallContextValue | null>(null);

function mapStartError(code: string, message?: string): string {
  switch (code) {
    case 'PEER_BUSY':
      return 'طرف مقابل در تماس دیگری است.';
    case 'UNAVAILABLE':
      return 'کاربر آنلاین نیست.';
    case 'BUSY':
      return 'شما هم‌اکنون در تماس هستید.';
    case 'FORBIDDEN':
      return 'اجازهٔ شروع تماس را ندارید.';
    case 'CONVERSATION_FAILED':
      return 'گفتگوی خصوصی باز نشد.';
    case 'INVALID_PAYLOAD':
    case 'NO_PEER':
    case 'INVALID_PEER':
      return message || 'درخواست تماس نامعتبر است.';
    default:
      return message || 'تماس برقرار نشد.';
  }
}

function mapEndedReason(reason: string | undefined): string {
  switch (reason) {
    case 'rejected':
      return 'تماس رد شد.';
    case 'cancelled':
      return 'تماس لغو شد.';
    case 'missed':
      return 'تماس از دست رفت.';
    case 'failed':
    case 'hangup':
      return 'تماس پایان یافت.';
    default:
      return 'تماس پایان یافت.';
  }
}

async function loadIceServers(): Promise<RTCIceServer[]> {
  const t = getAccessToken();
  if (!t) return [];
  try {
    const data = await apiFetch<{ iceServers: RTCIceServer[] }>('calls/webrtc-config', {
      method: 'GET',
      token: t,
    });
    return Array.isArray(data.iceServers) ? data.iceServers : [];
  } catch {
    return [];
  }
}

export function VoiceCallProvider({ children }: { children: ReactNode }) {
  const { socket } = useAppRealtime();
  const socketRef = useRef<Socket | null>(null);
  socketRef.current = socket;

  const [phase, setPhase] = useState<CallPhase>('idle');
  const [peer, setPeer] = useState<VoicePeer | null>(null);
  const [muted, setMuted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [endedReason, setEndedReason] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const roleRef = useRef<'caller' | 'callee' | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingOfferSdpRef = useRef<string | null>(null);
  const callerMediaStartedRef = useRef(false);
  const calleeMediaStartedRef = useRef(false);
  const phaseRef = useRef<CallPhase>('idle');
  const timerRef = useRef<number | null>(null);
  const endedTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (endedTimerRef.current != null) {
      window.clearTimeout(endedTimerRef.current);
      endedTimerRef.current = null;
    }
  }, []);

  const teardownMedia = useCallback(() => {
    clearTimers();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    const a = remoteAudioRef.current;
    if (a) {
      a.srcObject = null;
    }
    pendingIceRef.current = [];
    pendingOfferSdpRef.current = null;
    callerMediaStartedRef.current = false;
    calleeMediaStartedRef.current = false;
    setMuted(false);
    setElapsedSeconds(0);
  }, [clearTimers]);

  const resetToIdle = useCallback(() => {
    teardownMedia();
    sessionIdRef.current = null;
    roleRef.current = null;
    conversationIdRef.current = null;
    setPeer(null);
    setPhase('idle');
    phaseRef.current = 'idle';
    setEndedReason(null);
  }, [teardownMedia]);

  const scheduleIdle = useCallback(
    (delayMs: number) => {
      if (endedTimerRef.current != null) window.clearTimeout(endedTimerRef.current);
      endedTimerRef.current = window.setTimeout(() => {
        endedTimerRef.current = null;
        resetToIdle();
      }, delayMs);
    },
    [resetToIdle],
  );

  const flushPendingIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc?.remoteDescription) return;
    const batch = [...pendingIceRef.current];
    pendingIceRef.current = [];
    for (const c of batch) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const startElapsedTimer = useCallback(() => {
    if (timerRef.current != null) window.clearInterval(timerRef.current);
    const started = Date.now();
    timerRef.current = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
  }, []);

  const wirePc = useCallback(
    (pc: RTCPeerConnection) => {
      pc.onicecandidate = (e) => {
        const sid = sessionIdRef.current;
        const s = socketRef.current;
        if (!sid || !s || !e.candidate) return;
        const json = e.candidate.toJSON();
        s.emit('call_signal', { sessionId: sid, type: 'ice-candidate', candidate: json });
      };

      pc.ontrack = (e) => {
        const el = remoteAudioRef.current;
        if (el && e.streams[0]) {
          el.srcObject = e.streams[0];
          void el.play().catch(() => {});
        }
      };

      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        // RTCPeerConnectionState has no 'completed'; ICE 'completed' maps to connectionState 'connected'.
        if (st === 'connected') {
          setPhase('active');
          startElapsedTimer();
        }
        if (st === 'failed' || st === 'disconnected') {
          setPhase('ended');
          setEndedReason('اتصال قطع شد یا برقرار نشد.');
          teardownMedia();
          const sid = sessionIdRef.current;
          const s = socketRef.current;
          if (sid && s) s.emit('call_end', { sessionId: sid });
          scheduleIdle(2800);
        }
      };
    },
    [scheduleIdle, startElapsedTimer, teardownMedia],
  );

  const applyAnswer = useCallback(
    async (sdp: string) => {
      const pc = pcRef.current;
      if (!pc || roleRef.current !== 'caller') return;
      await pc.setRemoteDescription({ type: 'answer', sdp });
      await flushPendingIce();
    },
    [flushPendingIce],
  );

  const applyOfferOrQueue = useCallback(
    async (sdp: string | undefined) => {
      if (!sdp) return;
      const pc = pcRef.current;
      if (!pc) {
        pendingOfferSdpRef.current = sdp;
        return;
      }
      await pc.setRemoteDescription({ type: 'offer', sdp });
      await flushPendingIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      const sid = sessionIdRef.current;
      const s = socketRef.current;
      if (sid && s) {
        s.emit('call_signal', { sessionId: sid, type: 'answer', sdp: answer.sdp });
      }
    },
    [flushPendingIce],
  );

  const handleRemoteSignal = useCallback(
    async (payload: {
      sessionId: string;
      fromUserId: string;
      type: string;
      sdp?: string;
      candidate?: RTCIceCandidateInit;
    }) => {
      if (payload.sessionId !== sessionIdRef.current) return;
      const pc = pcRef.current;

      if (payload.type === 'offer' && roleRef.current === 'callee') {
        await applyOfferOrQueue(payload.sdp);
        return;
      }
      if (payload.type === 'answer' && roleRef.current === 'caller') {
        if (payload.sdp) await applyAnswer(payload.sdp);
        return;
      }
      if (payload.type === 'ice-candidate' && payload.candidate) {
        if (pc?.remoteDescription) {
          try {
            await pc.addIceCandidate(payload.candidate);
          } catch {
            pendingIceRef.current.push(payload.candidate);
          }
        } else {
          pendingIceRef.current.push(payload.candidate);
        }
      }
    },
    [applyAnswer, applyOfferOrQueue],
  );

  const runCallerMedia = useCallback(async () => {
    setPhase('connecting');
    try {
      const ice = await loadIceServers();
      const pc = new RTCPeerConnection({ iceServers: ice });
      pcRef.current = pc;
      wirePc(pc);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sid = sessionIdRef.current;
      const s = socketRef.current;
      if (!sid || !s) return;
      s.emit('call_signal', { sessionId: sid, type: 'offer', sdp: offer.sdp });
    } catch (e) {
      setPhase('ended');
      setEndedReason(
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'دسترسی به میکروفون داده نشد.'
          : 'خطا در آماده‌سازی تماس صوتی.',
      );
      teardownMedia();
      const sid = sessionIdRef.current;
      const s = socketRef.current;
      if (sid && s) s.emit('call_end', { sessionId: sid });
      scheduleIdle(3200);
    }
  }, [scheduleIdle, teardownMedia, wirePc]);

  const runCalleeMedia = useCallback(async () => {
    setPhase('connecting');
    try {
      const ice = await loadIceServers();
      const pc = new RTCPeerConnection({ iceServers: ice });
      pcRef.current = pc;
      wirePc(pc);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      if (pendingOfferSdpRef.current) {
        const sdp = pendingOfferSdpRef.current;
        pendingOfferSdpRef.current = null;
        await pc.setRemoteDescription({ type: 'offer', sdp });
        await flushPendingIce();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const sid = sessionIdRef.current;
        const s = socketRef.current;
        if (sid && s) {
          s.emit('call_signal', { sessionId: sid, type: 'answer', sdp: answer.sdp });
        }
      }
    } catch (e) {
      setPhase('ended');
      setEndedReason(
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'دسترسی به میکروفون داده نشد.'
          : 'خطا در آماده‌سازی تماس صوتی.',
      );
      teardownMedia();
      const sid = sessionIdRef.current;
      const s = socketRef.current;
      if (sid && s) {
        s.emit('call_reject', { sessionId: sid });
      }
      scheduleIdle(3200);
    }
  }, [flushPendingIce, scheduleIdle, teardownMedia, wirePc]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (!socket) return;

    const onInvite = (payload: {
      sessionId: string;
      callType: string;
      conversationId: string;
      caller: VoicePeer;
    }) => {
      if (phaseRef.current !== 'idle') return;
      sessionIdRef.current = payload.sessionId;
      conversationIdRef.current = payload.conversationId;
      roleRef.current = 'callee';
      callerMediaStartedRef.current = false;
      calleeMediaStartedRef.current = false;
      setPeer(payload.caller);
      setPhase('incoming');
      phaseRef.current = 'incoming';
      pendingOfferSdpRef.current = null;
    };

    const onAcceptedPayload = (payload: { sessionId: string }) => {
      if (payload.sessionId !== sessionIdRef.current) return;
      if (roleRef.current === 'caller') {
        if (callerMediaStartedRef.current) return;
        callerMediaStartedRef.current = true;
        void runCallerMedia();
        return;
      }
      if (roleRef.current === 'callee') {
        if (calleeMediaStartedRef.current) return;
        calleeMediaStartedRef.current = true;
        void runCalleeMedia();
      }
    };

    const onEnded = (payload: { sessionId: string; status: string; reason?: string }) => {
      if (payload.sessionId !== sessionIdRef.current) return;
      setPhase('ended');
      setEndedReason(mapEndedReason(payload.reason));
      teardownMedia();
      scheduleIdle(2800);
    };

    const onSignal = (payload: {
      sessionId: string;
      fromUserId: string;
      type: string;
      sdp?: string;
      candidate?: RTCIceCandidateInit;
    }) => {
      void handleRemoteSignal(payload);
    };

    socket.on('call_invite', onInvite);
    socket.on('call_accepted', onAcceptedPayload);
    socket.on('call_ended', onEnded);
    socket.on('call_signal', onSignal);

    return () => {
      socket.off('call_invite', onInvite);
      socket.off('call_accepted', onAcceptedPayload);
      socket.off('call_ended', onEnded);
      socket.off('call_signal', onSignal);
    };
  }, [handleRemoteSignal, runCalleeMedia, runCallerMedia, scheduleIdle, socket, teardownMedia]);

  const startCall = useCallback(
    (opts: { conversationId?: string; targetUserId?: string }) => {
      const s = socketRef.current;
      if (!s?.connected) {
        setPhase('ended');
        setEndedReason('اتصال زنده برقرار نیست. صفحه را تازه کنید.');
        scheduleIdle(3000);
        return;
      }
      setEndedReason(null);
      setPhase('outgoing');
      phaseRef.current = 'outgoing';
      roleRef.current = 'caller';
      callerMediaStartedRef.current = false;
      calleeMediaStartedRef.current = false;
      pendingOfferSdpRef.current = null;

      s.emit(
        'call_start',
        {
          conversationId: opts.conversationId?.trim() || undefined,
          targetUserId: opts.targetUserId?.trim() || undefined,
        },
        (ack: CallStartAck) => {
          if (!ack?.ok) {
            setPhase('ended');
            setEndedReason(mapStartError(ack?.code ?? 'UNKNOWN', ack?.message));
            scheduleIdle(3200);
            return;
          }
          sessionIdRef.current = ack.sessionId;
          conversationIdRef.current = ack.conversationId;
          setPeer(ack.peer);
        },
      );
    },
    [scheduleIdle],
  );

  const acceptIncoming = useCallback(() => {
    const sid = sessionIdRef.current;
    const s = socketRef.current;
    if (!sid || !s) return;
    s.emit('call_accept', { sessionId: sid }, (res: { ok?: boolean; code?: string }) => {
      if (res?.ok === false) {
        setPhase('ended');
        setEndedReason('پذیرش تماس ممکن نشد.');
        scheduleIdle(2800);
      }
    });
  }, [scheduleIdle]);

  const rejectIncoming = useCallback(() => {
    const sid = sessionIdRef.current;
    const s = socketRef.current;
    if (!sid || !s) return;
    s.emit('call_reject', { sessionId: sid });
    resetToIdle();
  }, [resetToIdle]);

  const hangup = useCallback(() => {
    const sid = sessionIdRef.current;
    const s = socketRef.current;
    if (sid && s) {
      s.emit('call_end', { sessionId: sid });
    }
    teardownMedia();
    if (phase === 'outgoing' || phase === 'incoming' || phase === 'connecting' || phase === 'active') {
      setPhase('ended');
      setEndedReason('تماس پایان یافت.');
      scheduleIdle(1800);
    } else {
      resetToIdle();
    }
  }, [phase, resetToIdle, scheduleIdle, teardownMedia]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !muted;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !nextMuted;
    });
    setMuted(nextMuted);
  }, [muted]);

  const value = useMemo<VoiceCallContextValue>(
    () => ({
      phase,
      peer,
      muted,
      elapsedSeconds,
      endedReason,
      startCall,
      acceptIncoming,
      rejectIncoming,
      hangup,
      toggleMute,
    }),
    [
      acceptIncoming,
      elapsedSeconds,
      endedReason,
      hangup,
      muted,
      peer,
      phase,
      rejectIncoming,
      startCall,
      toggleMute,
    ],
  );

  const showOverlay = phase !== 'idle';

  return (
    <VoiceCallContext.Provider value={value}>
      {children}
      <audio ref={remoteAudioRef} className="hidden" playsInline autoPlay aria-hidden />
      {showOverlay ? (
        <div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 px-6 text-white"
          dir="rtl"
          role="dialog"
          aria-modal="true"
          aria-label="تماس صوتی"
        >
          <div className="mb-8 flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 ring-4 ring-slate-700/80 shadow-2xl">
            {peer?.avatar ? (
              <img src={peer.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-4xl font-extrabold text-slate-300">
                {(peer?.name ?? '?').trim().slice(0, 1) || '?'}
              </span>
            )}
          </div>
          <h2 className="text-center text-xl font-extrabold tracking-tight">{peer?.name ?? 'تماس'}</h2>
          <p className="mt-2 text-center text-sm font-medium text-slate-400">
            {phase === 'incoming' ? 'تماس ورودی' : null}
            {phase === 'outgoing' ? 'در حال برقراری تماس…' : null}
            {phase === 'connecting' ? 'در حال اتصال…' : null}
            {phase === 'active' ? `در تماس — ${formatClock(elapsedSeconds)}` : null}
            {phase === 'ended' ? endedReason ?? 'پایان' : null}
          </p>

          <div className="mt-12 flex w-full max-w-xs flex-wrap items-center justify-center gap-4">
            {phase === 'incoming' ? (
              <>
                <button
                  type="button"
                  onClick={() => rejectIncoming()}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-2xl shadow-lg transition hover:bg-red-700"
                  aria-label="رد تماس"
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={() => acceptIncoming()}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-2xl shadow-lg transition hover:bg-emerald-600"
                  aria-label="پاسخ به تماس"
                >
                  ✓
                </button>
              </>
            ) : null}

            {phase === 'outgoing' || phase === 'connecting' ? (
              <button
                type="button"
                onClick={() => hangup()}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-xl font-bold shadow-lg transition hover:bg-red-700"
                aria-label="لغو تماس"
              >
                لغو
              </button>
            ) : null}

            {phase === 'active' ? (
              <>
                <button
                  type="button"
                  onClick={() => toggleMute()}
                  className={`flex h-14 w-14 items-center justify-center rounded-full text-lg shadow-lg transition ${
                    muted ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                  aria-label={muted ? 'روشن کردن میکروفون' : 'بی‌صدا'}
                >
                  {muted ? '🔇' : '🎤'}
                </button>
                <button
                  type="button"
                  onClick={() => hangup()}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-xl font-bold shadow-lg transition hover:bg-red-700"
                  aria-label="پایان تماس"
                >
                  پایان
                </button>
              </>
            ) : null}

            {phase === 'ended' ? (
              <p className="w-full text-center text-xs text-slate-500">در حال بستن…</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </VoiceCallContext.Provider>
  );
}

function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function useVoiceCall(): VoiceCallContextValue {
  const ctx = useContext(VoiceCallContext);
  if (!ctx) {
    throw new Error('useVoiceCall must be used within VoiceCallProvider');
  }
  return ctx;
}
