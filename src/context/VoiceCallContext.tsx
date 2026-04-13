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

type LastCallOpts = { conversationId?: string; targetUserId?: string };

type CallStartAck =
  | {
      ok: true;
      sessionId: string;
      conversationId: string;
      callType: string;
      peer: VoicePeer;
    }
  | { ok: false; code: string; message?: string };

export type VoiceCallContextValue = {
  phase: CallPhase;
  peer: VoicePeer | null;
  muted: boolean;
  elapsedSeconds: number;
  endedReason: string | null;
  /** Only when idle can a new call be started from entry points (avoids stacking calls). */
  canStartCall: boolean;
  startCall: (opts: LastCallOpts) => void;
  acceptIncoming: () => void;
  rejectIncoming: () => void;
  hangup: () => void;
  toggleMute: () => void;
  /** Close the ended overlay without waiting for auto-dismiss. */
  dismissEnded: () => void;
  /** Redial using the last conversation or profile target (if any). */
  retryLastCall: () => void;
};

const VoiceCallContext = createContext<VoiceCallContextValue | null>(null);

const CONNECTING_TIMEOUT_MS = 55_000;

/** Dev/staging: set NEXT_PUBLIC_VOICE_CALL_DEBUG=1 at build time to surface WebRTC state on the call overlay. */
const VOICE_CALL_DEBUG =
  process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_VOICE_CALL_DEBUG === '1';

function mapStartError(code: string, message?: string): string {
  switch (code) {
    case 'PEER_BUSY':
      return 'طرف مقابل الان سر خط دیگری است. کمی بعد دوباره امتحان کنید.';
    case 'UNAVAILABLE':
      return 'این کاربر الان آنلاین نیست؛ وقتی برخط بود دوباره تماس بگیرید.';
    case 'BUSY':
      return 'شما هم‌اکنون در یک تماس یا فرآیند تماس هستید. ابتدا تماس جاری را تمام کنید.';
    case 'FORBIDDEN':
      return 'اجازهٔ شروع این تماس را ندارید.';
    case 'CONVERSATION_FAILED':
      return 'گفتگوی خصوصی باز نشد. صفحه را تازه کنید و دوباره تلاش کنید.';
    case 'INVALID_PAYLOAD':
    case 'NO_PEER':
    case 'INVALID_PEER':
      return message || 'درخواست تماس نامعتبر است.';
    default:
      return message || 'تماس برقرار نشد. دوباره تلاش کنید.';
  }
}

function mapCallEndedMessage(
  reason: string | undefined,
  status: string | undefined,
  role: 'caller' | 'callee' | null,
): string {
  const r = reason ?? '';
  const st = status ?? '';

  if (r === 'rejected' || st === 'REJECTED') {
    return role === 'caller' ? 'طرف مقابل تماس را نپذیرفت.' : 'تماس رد شد.';
  }
  if (r === 'cancelled') {
    return role === 'caller' ? 'تماس را لغو کردید.' : 'تماس توسط طرف مقابل لغو شد.';
  }
  if (r === 'missed' || st === 'MISSED') {
    return role === 'caller' ? 'تماس بدون پاسخ ماند.' : 'تماس ورودی پاسخ داده نشد.';
  }
  if (r === 'failed' || st === 'FAILED') {
    return 'ارتباط صوتی برقرار نشد یا قطع شد.';
  }
  if (r === 'hangup' || st === 'ENDED') {
    return 'تماس به پایان رسید.';
  }
  return 'تماس پایان یافت.';
}

/** First audio m= line + direction attributes (no full SDP). */
/** Summarize servers from API (no URLs/credentials logged). */
function summarizeIceServersConfig(servers: RTCIceServer[]): { count: number; hasRelayHint: boolean } {
  let hasRelayHint = false;
  for (const s of servers) {
    const u = s.urls;
    const arr: string[] =
      typeof u === 'string' ? [u] : Array.isArray(u) ? u.filter((x): x is string => typeof x === 'string') : [];
    for (const x of arr) {
      const low = x.toLowerCase();
      if (low.startsWith('turn:') || low.startsWith('turns:')) hasRelayHint = true;
    }
  }
  return { count: servers.length, hasRelayHint };
}

/**
 * Dev-only: parse RTCStatsReport for selected ICE pair + audio RTP counters.
 * Handles Chromium (candidate-pair.selected), transport.selectedCandidatePairId, and common fallbacks.
 */
function formatIceStatsFromReport(report: RTCStatsReport): string[] {
  const byId = new Map<string, RTCStats>();
  report.forEach((s) => byId.set(s.id, s));

  const lines: string[] = [];
  lines.push('--- getStats (ICE / RTP) ---');

  let transportSelectedPairId: string | undefined;
  report.forEach((s) => {
    if (s.type === 'transport') {
      const t = s as unknown as Record<string, unknown>;
      const id = t.selectedCandidatePairId;
      if (typeof id === 'string' && id) transportSelectedPairId = id;
    }
  });

  const pairs: RTCStats[] = [];
  report.forEach((s) => {
    if (s.type === 'candidate-pair') pairs.push(s);
  });

  let selectedPair: RTCStats | undefined;
  for (const p of pairs) {
    const raw = p as unknown as Record<string, unknown>;
    if (raw.selected === true || p.id === transportSelectedPairId) {
      selectedPair = p;
      break;
    }
  }
  if (!selectedPair) {
    selectedPair = pairs.find((p) => (p as unknown as Record<string, unknown>).state === 'succeeded');
  }

  const readPair = (p: RTCStats) => p as unknown as Record<string, unknown>;
  const readCand = (p: RTCStats | undefined) => (p ? (p as unknown as Record<string, unknown>) : undefined);

  if (!selectedPair) {
    lines.push('selectedCandidatePair: NO');
    lines.push(
      pairs.length === 0
        ? 'candidate-pair stats: 0 (ICE gathering may not have emitted pairs yet)'
        : `candidate-pair stats: ${pairs.length} (none selected / none succeeded yet)`,
    );
    for (const p of pairs.slice(0, 3)) {
      const x = readPair(p);
      lines.push(
        `  pair id=${p.id} state=${String(x.state)} nominated=${String(x.nominated)} bytesSent=${String(x.bytesSent ?? '—')} bytesRecv=${String(x.bytesReceived ?? '—')}`,
      );
    }
  } else {
    const cp = readPair(selectedPair);
    const locId = typeof cp.localCandidateId === 'string' ? cp.localCandidateId : undefined;
    const remId = typeof cp.remoteCandidateId === 'string' ? cp.remoteCandidateId : undefined;
    const loc = locId ? byId.get(locId) : undefined;
    const rem = remId ? byId.get(remId) : undefined;
    const lc = readCand(loc);
    const rc = readCand(rem);

    const rtt = cp.currentRoundTripTime;
    const rttMs =
      typeof rtt === 'number' && Number.isFinite(rtt) ? (rtt * 1000).toFixed(0) : 'n/a';

    lines.push(`selectedCandidatePair: YES id=${selectedPair.id}`);
    lines.push(`  state=${String(cp.state)} nominated=${String(cp.nominated)} rttMs≈${rttMs} (from CRTP)`);
    lines.push(`  pair bytesSent=${String(cp.bytesSent ?? '—')} bytesReceived=${String(cp.bytesReceived ?? '—')}`);
    if (typeof cp.packetsSent === 'number' || typeof cp.packetsReceived === 'number') {
      lines.push(
        `  pair packetsSent=${String(cp.packetsSent ?? '—')} packetsReceived=${String(cp.packetsReceived ?? '—')}`,
      );
    }
    lines.push(
      `  localCandidateId=${locId ?? '—'} type=${String(lc?.candidateType ?? '—')} protocol=${String(lc?.protocol ?? '—')}`,
    );
    lines.push(
      `  remoteCandidateId=${remId ?? '—'} type=${String(rc?.candidateType ?? '—')} protocol=${String(rc?.protocol ?? '—')}`,
    );
  }

  let obPackets = 0;
  let obBytes = 0;
  let ibPackets = 0;
  let ibBytes = 0;
  let sawOb = false;
  let sawIb = false;

  report.forEach((s) => {
    const t = s.type;
    const k = (s as unknown as Record<string, unknown>).kind;
    if (t === 'outbound-rtp' && k === 'audio') {
      sawOb = true;
      const x = s as unknown as Record<string, unknown>;
      if (typeof x.packetsSent === 'number') obPackets += x.packetsSent;
      if (typeof x.bytesSent === 'number') obBytes += x.bytesSent;
    }
    if (t === 'inbound-rtp' && k === 'audio') {
      sawIb = true;
      const x = s as unknown as Record<string, unknown>;
      if (typeof x.packetsReceived === 'number') ibPackets += x.packetsReceived;
      if (typeof x.bytesReceived === 'number') ibBytes += x.bytesReceived;
    }
  });

  if (sawOb) {
    lines.push(`outbound-rtp audio: packetsSent=${obPackets} bytesSent=${obBytes}`);
  } else {
    lines.push('outbound-rtp audio: (no report yet)');
  }
  if (sawIb) {
    lines.push(`inbound-rtp audio: packetsReceived=${ibPackets} bytesReceived=${ibBytes}`);
  } else {
    lines.push('inbound-rtp audio: (no report yet)');
  }

  const pairBytesOut = selectedPair ? Number(readPair(selectedPair).bytesSent ?? 0) : 0;
  const pairBytesIn = selectedPair ? Number(readPair(selectedPair).bytesReceived ?? 0) : 0;
  const noPair = !selectedPair;
  const noRtpFlow = (obBytes === 0 && ibBytes === 0 && obPackets === 0 && ibPackets === 0) || (!sawOb && !sawIb);
  if (noPair) {
    lines.push('diag: no selected/succeeded pair — likely ICE still checking or blocked (need TURN?)');
  } else if (pairBytesOut === 0 && pairBytesIn === 0 && noRtpFlow) {
    lines.push('diag: pair selected but 0 bytes on pair + 0 RTP — path may not carry media yet');
  } else if (obBytes === 0 && sawOb) {
    lines.push('diag: outbound RTP reports 0 bytesSent — mic/sender path may not be encoding');
  } else if (ibBytes === 0 && sawIb) {
    lines.push('diag: inbound RTP reports 0 bytesReceived — remote not received or decrypt fail');
  } else {
    lines.push('diag: counters non-zero or reports pending — compare local/remote candidate types (host vs relay)');
  }

  return lines;
}

function extractAudioSdpHints(sdp: string | null | undefined): string[] {
  if (!sdp) return [];
  const lines = sdp.split(/\r?\n/);
  const out: string[] = [];
  let inAudio = false;
  for (const line of lines) {
    if (line.startsWith('m=')) {
      if (line.startsWith('m=audio')) {
        inAudio = true;
        out.push(line.trim());
      } else {
        inAudio = false;
      }
      continue;
    }
    if (!inAudio) continue;
    const t = line.trim();
    if (
      t.startsWith('a=sendonly') ||
      t.startsWith('a=recvonly') ||
      t.startsWith('a=sendrecv') ||
      t.startsWith('a=inactive')
    ) {
      out.push(t);
    }
    if (out.length >= 5) break;
  }
  return out;
}

function getMediaErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'میکروفون در دسترس نیست یا خطایی رخ داد.';
  const n = err.name;
  if (n === 'NotAllowedError' || n === 'PermissionDeniedError') {
    return 'دسترسی به میکروفون داده نشد. در نوار آدرس مرورگر اجازهٔ ضبط صدا را بدهید و دوباره تلاش کنید.';
  }
  if (n === 'NotFoundError' || n === 'DevicesNotFoundError') {
    return 'میکروفونی روی این دستگاه پیدا نشد.';
  }
  if (n === 'NotReadableError' || n === 'TrackStartError') {
    return 'میکروفون توسط برنامهٔ دیگری اشغال است یا در دسترس نیست.';
  }
  if (n === 'OverconstrainedError') {
    return 'تنظیمات دستگاه با درخواست تماس سازگار نیست.';
  }
  if (n === 'AbortError') {
    return 'باز کردن میکروفون متوقف شد.';
  }
  return 'خطا در دسترسی به میکروفون. مرورگر یا دستگاه را بررسی کنید.';
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
  const [voiceDbgTick, setVoiceDbgTick] = useState(0);
  const [voiceIceDbgText, setVoiceIceDbgText] = useState('');

  const sessionIdRef = useRef<string | null>(null);
  const roleRef = useRef<'caller' | 'callee' | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remotePlayDiagRef = useRef<string>('—');
  /** Last ICE list from /calls/webrtc-config (counts only; cleared on teardown). */
  const iceServerSummaryRef = useRef<{ count: number; hasRelayHint: boolean } | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingOfferSdpRef = useRef<string | null>(null);
  const callerMediaStartedRef = useRef(false);
  const calleeMediaStartedRef = useRef(false);
  const phaseRef = useRef<CallPhase>('idle');
  const timerRef = useRef<number | null>(null);
  const endedTimerRef = useRef<number | null>(null);
  const connectingTimerRef = useRef<number | null>(null);
  const lastCallOptsRef = useRef<LastCallOpts | null>(null);
  /** Ensures we only run connecting→active transition once per PC (both ICE and connection handlers may fire). */
  const callActivatedRef = useRef(false);
  /** Serializes call_signal handling so SDP steps and ICE adds cannot interleave across parallel async tasks. */
  const signalChainRef = useRef<Promise<void>>(Promise.resolve());
  const iceFailTimerRef = useRef<number | null>(null);
  const connFailTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (endedTimerRef.current != null) {
      window.clearTimeout(endedTimerRef.current);
      endedTimerRef.current = null;
    }
    if (connectingTimerRef.current != null) {
      window.clearTimeout(connectingTimerRef.current);
      connectingTimerRef.current = null;
    }
  }, []);

  const clearConnectingTimer = useCallback(() => {
    if (connectingTimerRef.current != null) {
      window.clearTimeout(connectingTimerRef.current);
      connectingTimerRef.current = null;
    }
  }, []);

  const teardownMedia = useCallback(() => {
    signalChainRef.current = Promise.resolve();
    if (iceFailTimerRef.current != null) {
      window.clearTimeout(iceFailTimerRef.current);
      iceFailTimerRef.current = null;
    }
    if (connFailTimerRef.current != null) {
      window.clearTimeout(connFailTimerRef.current);
      connFailTimerRef.current = null;
    }
    clearConnectingTimer();
    clearTimers();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    const a = remoteAudioRef.current;
    if (a) {
      a.srcObject = null;
    }
    remotePlayDiagRef.current = '—';
    iceServerSummaryRef.current = null;
    pendingIceRef.current = [];
    pendingOfferSdpRef.current = null;
    callerMediaStartedRef.current = false;
    calleeMediaStartedRef.current = false;
    callActivatedRef.current = false;
    setMuted(false);
    setElapsedSeconds(0);
  }, [clearConnectingTimer, clearTimers]);

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

  const goToEnded = useCallback(
    (message: string, autoDismissMs: number) => {
      setPhase('ended');
      phaseRef.current = 'ended';
      setEndedReason(message);
      teardownMedia();
      scheduleIdle(autoDismissMs);
    },
    [scheduleIdle, teardownMedia],
  );

  const flushPendingIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc?.remoteDescription) return;
    // Drain in a loop: while we await addIceCandidate, other call_signal handlers can enqueue
    // more candidates; a single batch would leave them forever (no later setRemoteDescription).
    for (;;) {
      const batch = [...pendingIceRef.current];
      if (batch.length === 0) break;
      pendingIceRef.current = [];
      for (const c of batch) {
        try {
          await pc.addIceCandidate(c);
        } catch {
          /* ignore */
        }
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

  /** Re-bind local mic to audio senders and remote audio receivers to the playback element (idempotent). */
  const syncVoiceMedia = useCallback((pc: RTCPeerConnection) => {
    const el = remoteAudioRef.current;
    const loc = localStreamRef.current;
    const localAudio = loc?.getAudioTracks().find((t) => t.readyState !== 'ended') ?? null;

    if (localAudio) {
      for (const tr of pc.getTransceivers()) {
        if (!tr.sender) continue;
        const rk = tr.receiver.track?.kind;
        const sk = tr.sender.track?.kind;
        if (rk === 'audio' || sk === 'audio') {
          if (tr.sender.track !== localAudio) void tr.sender.replaceTrack(localAudio);
        }
      }
    }

    const remoteTracks = pc
      .getReceivers()
      .map((r) => r.track)
      .filter((t): t is MediaStreamTrack => !!t && t.kind === 'audio' && t.readyState !== 'ended');

    if (!el || remoteTracks.length === 0) return;

    el.srcObject = new MediaStream(remoteTracks);
    el.muted = false;
    const p = el.play();
    if (p !== undefined) {
      void p.then(
        () => {
          remotePlayDiagRef.current = 'ok';
        },
        (err: unknown) => {
          remotePlayDiagRef.current = err instanceof Error ? err.message : String(err);
          window.setTimeout(() => {
            if (pcRef.current !== pc) return;
            const audioEl = remoteAudioRef.current;
            if (!audioEl?.srcObject) return;
            void audioEl.play().then(
              () => {
                remotePlayDiagRef.current = 'ok (retry)';
              },
              (e: unknown) => {
                remotePlayDiagRef.current = e instanceof Error ? `retry: ${e.message}` : 'retry failed';
              },
            );
          }, 350);
        },
      );
    } else {
      remotePlayDiagRef.current = '— no promise';
    }
  }, []);

  const failConnection = useCallback(
    (message: string) => {
      if (iceFailTimerRef.current != null) {
        window.clearTimeout(iceFailTimerRef.current);
        iceFailTimerRef.current = null;
      }
      if (connFailTimerRef.current != null) {
        window.clearTimeout(connFailTimerRef.current);
        connFailTimerRef.current = null;
      }
      const sid = sessionIdRef.current;
      const s = socketRef.current;
      if (sid && s) s.emit('call_end', { sessionId: sid });
      goToEnded(message, 4200);
    },
    [goToEnded],
  );

  const tryActivateFromPc = useCallback(
    (pc: RTCPeerConnection) => {
      if (pc !== pcRef.current || callActivatedRef.current) return;
      if (phaseRef.current !== 'connecting') return;
      const ice = pc.iceConnectionState;
      const cs = pc.connectionState;
      const iceReady = ice === 'connected' || ice === 'completed';
      const connReady = cs === 'connected';
      const hasLiveRemoteAudio = pc
        .getReceivers()
        .some((r) => r.track?.kind === 'audio' && r.track.readyState === 'live');
      if (!iceReady && !connReady && !hasLiveRemoteAudio) return;
      callActivatedRef.current = true;
      clearConnectingTimer();
      setPhase('active');
      phaseRef.current = 'active';
      startElapsedTimer();
      syncVoiceMedia(pc);
    },
    [clearConnectingTimer, startElapsedTimer, syncVoiceMedia],
  );

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
        const track = e.track;
        if (track?.kind === 'audio') {
          const tryAgain = () => syncVoiceMedia(pc);
          track.addEventListener('unmute', tryAgain, { once: true });
        }
        syncVoiceMedia(pc);
        tryActivateFromPc(pc);
      };

      pc.oniceconnectionstatechange = () => {
        const ice = pc.iceConnectionState;
        if (ice !== 'failed') {
          if (iceFailTimerRef.current != null) {
            window.clearTimeout(iceFailTimerRef.current);
            iceFailTimerRef.current = null;
          }
        }
        if (ice === 'failed') {
          const snapshot = pc;
          if (iceFailTimerRef.current != null) window.clearTimeout(iceFailTimerRef.current);
          iceFailTimerRef.current = window.setTimeout(() => {
            iceFailTimerRef.current = null;
            if (snapshot !== pcRef.current || snapshot.iceConnectionState !== 'failed') return;
            failConnection('ارتباط شبکه برای تماس صوتی قطع شد.');
          }, 3200);
          return;
        }
        tryActivateFromPc(pc);
      };

      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st !== 'failed') {
          if (connFailTimerRef.current != null) {
            window.clearTimeout(connFailTimerRef.current);
            connFailTimerRef.current = null;
          }
        }
        if (st === 'failed') {
          const snapshot = pc;
          if (connFailTimerRef.current != null) window.clearTimeout(connFailTimerRef.current);
          connFailTimerRef.current = window.setTimeout(() => {
            connFailTimerRef.current = null;
            if (snapshot !== pcRef.current || snapshot.connectionState !== 'failed') return;
            failConnection('اتصال تماس برقرار نشد یا قطع شد.');
          }, 3200);
          return;
        }
        tryActivateFromPc(pc);
      };
    },
    [failConnection, syncVoiceMedia, tryActivateFromPc],
  );

  const startConnectingWatchdog = useCallback(() => {
    clearConnectingTimer();
    connectingTimerRef.current = window.setTimeout(() => {
      connectingTimerRef.current = null;
      if (phaseRef.current !== 'connecting') return;
      failConnection('اتصال بیش از حد طول کشید. شبکه یا سرور TURN را بررسی کنید.');
    }, CONNECTING_TIMEOUT_MS);
  }, [clearConnectingTimer, failConnection]);

  const applyAnswer = useCallback(
    async (sdp: string) => {
      const pc = pcRef.current;
      if (!pc || roleRef.current !== 'caller') return;
      await pc.setRemoteDescription({ type: 'answer', sdp });
      await flushPendingIce();
      syncVoiceMedia(pc);
    },
    [flushPendingIce, syncVoiceMedia],
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
      syncVoiceMedia(pc);
    },
    [flushPendingIce, syncVoiceMedia],
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
          await flushPendingIce();
        } else {
          pendingIceRef.current.push(payload.candidate);
        }
      }
    },
    [applyAnswer, applyOfferOrQueue, flushPendingIce],
  );

  const runCallerMedia = useCallback(async () => {
    setPhase('connecting');
    phaseRef.current = 'connecting';
    startConnectingWatchdog();
    try {
      const ice = await loadIceServers();
      iceServerSummaryRef.current = summarizeIceServersConfig(ice);
      const pc = new RTCPeerConnection({ iceServers: ice });
      callActivatedRef.current = false;
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
      goToEnded(getMediaErrorMessage(e), 5000);
      const sid = sessionIdRef.current;
      const s = socketRef.current;
      if (sid && s) s.emit('call_end', { sessionId: sid });
    }
  }, [goToEnded, startConnectingWatchdog, wirePc]);

  const runCalleeMedia = useCallback(async () => {
    setPhase('connecting');
    phaseRef.current = 'connecting';
    startConnectingWatchdog();
    try {
      // Mic before pcRef: if the offer is applied during getUserMedia, createAnswer runs without local tracks.
      const ice = await loadIceServers();
      iceServerSummaryRef.current = summarizeIceServersConfig(ice);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({ iceServers: ice });
      callActivatedRef.current = false;
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      wirePc(pc);

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
        syncVoiceMedia(pc);
      }
    } catch (e) {
      goToEnded(getMediaErrorMessage(e), 5000);
      const sid = sessionIdRef.current;
      const s = socketRef.current;
      if (sid && s) {
        s.emit('call_reject', { sessionId: sid });
      }
    }
  }, [flushPendingIce, goToEnded, startConnectingWatchdog, syncVoiceMedia, wirePc]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (!VOICE_CALL_DEBUG) return;
    if (phase !== 'connecting' && phase !== 'active') return;
    const id = window.setInterval(() => setVoiceDbgTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (!VOICE_CALL_DEBUG) {
      setVoiceIceDbgText('');
      return;
    }
    if (phase !== 'connecting' && phase !== 'active') {
      setVoiceIceDbgText('');
      return;
    }
    const pc = pcRef.current;
    if (!pc) {
      setVoiceIceDbgText('getStats: (no pc)');
      return;
    }
    let cancelled = false;
    void pc.getStats().then((report) => {
      if (cancelled) return;
      setVoiceIceDbgText(formatIceStatsFromReport(report).join('\n'));
    }).catch((e: unknown) => {
      if (cancelled) return;
      setVoiceIceDbgText(`getStats failed: ${e instanceof Error ? e.message : String(e)}`);
    });
    return () => {
      cancelled = true;
    };
  }, [phase, voiceDbgTick]);

  useEffect(() => {
    if (!socket) return;

    const onInvite = (payload: {
      sessionId: string;
      callType: string;
      conversationId: string;
      caller: VoicePeer;
    }) => {
      if (phaseRef.current !== 'idle') return;
      lastCallOptsRef.current = { conversationId: payload.conversationId };
      sessionIdRef.current = payload.sessionId;
      conversationIdRef.current = payload.conversationId;
      roleRef.current = 'callee';
      callerMediaStartedRef.current = false;
      calleeMediaStartedRef.current = false;
      setPeer(payload.caller);
      setPhase('incoming');
      phaseRef.current = 'incoming';
      pendingOfferSdpRef.current = null;
      setEndedReason(null);
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

    const onEnded = (payload: { sessionId: string; status?: string; reason?: string }) => {
      if (payload.sessionId !== sessionIdRef.current) return;
      const msg = mapCallEndedMessage(payload.reason, payload.status, roleRef.current);
      setPhase('ended');
      phaseRef.current = 'ended';
      setEndedReason(msg);
      teardownMedia();
      scheduleIdle(3800);
    };

    const onSignal = (payload: {
      sessionId: string;
      fromUserId: string;
      type: string;
      sdp?: string;
      candidate?: RTCIceCandidateInit;
    }) => {
      signalChainRef.current = signalChainRef.current
        .then(() => handleRemoteSignal(payload))
        .catch(() => {});
    };

    const onPeerBusy = () => {
      if (phaseRef.current !== 'outgoing') return;
      setPhase('ended');
      phaseRef.current = 'ended';
      setEndedReason(mapStartError('PEER_BUSY'));
      sessionIdRef.current = null;
      teardownMedia();
      scheduleIdle(4200);
    };

    socket.on('call_invite', onInvite);
    socket.on('call_accepted', onAcceptedPayload);
    socket.on('call_ended', onEnded);
    socket.on('call_signal', onSignal);
    socket.on('call_peer_busy', onPeerBusy);

    return () => {
      socket.off('call_invite', onInvite);
      socket.off('call_accepted', onAcceptedPayload);
      socket.off('call_ended', onEnded);
      socket.off('call_signal', onSignal);
      socket.off('call_peer_busy', onPeerBusy);
    };
  }, [handleRemoteSignal, runCalleeMedia, runCallerMedia, scheduleIdle, socket, teardownMedia]);

  const dismissEnded = useCallback(() => {
    if (endedTimerRef.current != null) {
      window.clearTimeout(endedTimerRef.current);
      endedTimerRef.current = null;
    }
    resetToIdle();
  }, [resetToIdle]);

  const startCall = useCallback(
    (opts: LastCallOpts) => {
      const s = socketRef.current;
      if (!s?.connected) {
        lastCallOptsRef.current = opts;
        goToEnded('اتصال زنده با سرور برقرار نیست. اینترنت را چک کنید یا صفحه را تازه کنید.', 4500);
        return;
      }
      lastCallOptsRef.current = {
        conversationId: opts.conversationId?.trim() || undefined,
        targetUserId: opts.targetUserId?.trim() || undefined,
      };
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
          conversationId: lastCallOptsRef.current.conversationId,
          targetUserId: lastCallOptsRef.current.targetUserId,
        },
        (ack: CallStartAck) => {
          if (!ack?.ok) {
            goToEnded(mapStartError(ack?.code ?? 'UNKNOWN', ack?.message), 4500);
            return;
          }
          sessionIdRef.current = ack.sessionId;
          conversationIdRef.current = ack.conversationId;
          lastCallOptsRef.current = {
            conversationId: ack.conversationId,
            targetUserId: lastCallOptsRef.current?.targetUserId,
          };
          setPeer(ack.peer);
        },
      );
    },
    [goToEnded],
  );

  const retryLastCall = useCallback(() => {
    const o = lastCallOptsRef.current;
    if (endedTimerRef.current != null) {
      window.clearTimeout(endedTimerRef.current);
      endedTimerRef.current = null;
    }
    teardownMedia();
    setEndedReason(null);
    setPhase('idle');
    phaseRef.current = 'idle';
    sessionIdRef.current = null;
    roleRef.current = null;
    if (!o?.conversationId && !o?.targetUserId) {
      return;
    }
    window.setTimeout(() => startCall(o), 0);
  }, [startCall, teardownMedia]);

  const acceptIncoming = useCallback(() => {
    const sid = sessionIdRef.current;
    const s = socketRef.current;
    if (!sid || !s) return;
    s.emit('call_accept', { sessionId: sid }, (res: { ok?: boolean; code?: string }) => {
      if (res?.ok === false) {
        goToEnded('پذیرش تماس ممکن نشد. دوباره تلاش کنید.', 4000);
      }
    });
  }, [goToEnded]);

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
    const r = roleRef.current;
    const ph = phaseRef.current;

    let localHint: string | null = null;
    if (ph === 'outgoing') {
      localHint = r === 'caller' ? 'در حال لغو تماس…' : null;
    } else if (ph === 'active') {
      localHint = 'در حال پایان تماس…';
    }

    if (localHint) {
      setEndedReason(localHint);
    }

    if (sid && s) {
      s.emit('call_end', { sessionId: sid });
    }
    teardownMedia();

    if (ph === 'outgoing' || ph === 'incoming' || ph === 'connecting' || ph === 'active') {
      setPhase('ended');
      phaseRef.current = 'ended';
      if (!localHint) {
        setEndedReason('تماس پایان یافت.');
      }
      scheduleIdle(2200);
    } else {
      resetToIdle();
    }
  }, [resetToIdle, scheduleIdle, teardownMedia]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !muted;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !nextMuted;
    });
    setMuted(nextMuted);
  }, [muted]);

  const canStartCall = phase === 'idle';

  const voiceDebugText = useMemo(() => {
    if (!VOICE_CALL_DEBUG) return '';
    if (phase !== 'connecting' && phase !== 'active') return '';
    void voiceDbgTick;
    const pc = pcRef.current;
    const loc = localStreamRef.current;
    const el = remoteAudioRef.current;
    const lines: string[] = [];
    lines.push('[VOICE_DEBUG] tmp — NODE_ENV=dev or NEXT_PUBLIC_VOICE_CALL_DEBUG=1');
    if (!pc) {
      lines.push('pc: null');
      return lines.join('\n');
    }
    lines.push(
      `pc.connectionState=${pc.connectionState} ice=${pc.iceConnectionState} sig=${pc.signalingState}`,
    );
    const iceSum = iceServerSummaryRef.current;
    lines.push(
      iceSum
        ? `webrtc-config iceServers: count=${iceSum.count} relayUrlsHint=${iceSum.hasRelayHint ? 'yes' : 'no'}`
        : 'webrtc-config iceServers: (not loaded yet or teardown)',
    );
    const localAudioTracks = loc?.getAudioTracks() ?? [];
    lines.push(`localAudioTracks count=${localAudioTracks.length}`);
    localAudioTracks.forEach((t, i) => {
      lines.push(`  L[${i}] readyState=${t.readyState} enabled=${t.enabled} muted=${t.muted}`);
    });
    const remoteAudioFromRx = pc
      .getReceivers()
      .map((r) => r.track)
      .filter((t): t is MediaStreamTrack => t?.kind === 'audio');
    lines.push(`remoteAudioTracks (via receivers)=${remoteAudioFromRx.length}`);
    remoteAudioFromRx.forEach((t, i) => {
      lines.push(`  R[${i}] readyState=${t.readyState} enabled=${t.enabled} muted=${t.muted}`);
    });
    lines.push('transceivers:');
    pc.getTransceivers().forEach((tr, i) => {
      const k = tr.receiver.track?.kind ?? tr.sender.track?.kind ?? '?';
      lines.push(
        `  T[${i}] kind=${k} dir=${tr.direction} cur=${String(tr.currentDirection)}`,
      );
    });
    lines.push('senders:');
    pc.getSenders().forEach((s, i) => {
      const t = s.track;
      lines.push(
        `  S[${i}] hasTrack=${Boolean(t)}${t ? ` kind=${t.kind} state=${t.readyState}` : ''}`,
      );
    });
    lines.push('receivers:');
    pc.getReceivers().forEach((r, i) => {
      const t = r.track;
      lines.push(
        `  Rx[${i}] hasTrack=${Boolean(t)}${t ? ` kind=${t.kind} state=${t.readyState}` : ''}`,
      );
    });
    lines.push(`<audio> srcObject=${el?.srcObject ? 'set' : 'none'} lastPlay=${remotePlayDiagRef.current}`);
    lines.push(`SDP local audio: ${extractAudioSdpHints(pc.localDescription?.sdp).join(' · ') || '—'}`);
    lines.push(`SDP remote audio: ${extractAudioSdpHints(pc.remoteDescription?.sdp).join(' · ') || '—'}`);
    return lines.join('\n');
  }, [phase, voiceDbgTick]);

  const value = useMemo<VoiceCallContextValue>(
    () => ({
      phase,
      peer,
      muted,
      elapsedSeconds,
      endedReason,
      canStartCall,
      startCall,
      acceptIncoming,
      rejectIncoming,
      hangup,
      toggleMute,
      dismissEnded,
      retryLastCall,
    }),
    [
      acceptIncoming,
      canStartCall,
      dismissEnded,
      elapsedSeconds,
      endedReason,
      hangup,
      muted,
      peer,
      phase,
      rejectIncoming,
      retryLastCall,
      startCall,
      toggleMute,
    ],
  );

  const showOverlay = phase !== 'idle';

  const phaseHeadline =
    phase === 'incoming'
      ? 'تماس ورودی'
      : phase === 'outgoing'
        ? 'در حال زنگ زدن…'
        : phase === 'connecting'
          ? 'در حال برقراری ارتباط صوتی…'
          : phase === 'active'
            ? 'در تماس'
            : phase === 'ended'
              ? 'پایان تماس'
              : '';

  const phaseHint =
    phase === 'incoming'
      ? 'برای پاسخ، سبز را بزنید؛ برای رد، قرمز.'
      : phase === 'outgoing'
        ? 'منتظر پاسخ طرف مقابل هستید.'
        : phase === 'connecting'
          ? 'در حال آماده‌سازی صدا و شبکه…'
          : phase === 'active'
            ? `مدت تماس ${formatClock(elapsedSeconds)}`
            : '';

  return (
    <VoiceCallContext.Provider value={value}>
      {children}
      {/* Avoid display:none — browsers often block or mute playback for hidden <audio>. */}
      <audio
        ref={remoteAudioRef}
        className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
        playsInline
        autoPlay
        aria-hidden
      />
      {showOverlay ? (
        <div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8 text-white"
          dir="rtl"
          role="dialog"
          aria-modal="true"
          aria-label="تماس صوتی"
        >
          <div className="mb-6 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 ring-4 ring-slate-700/80 shadow-2xl sm:h-28 sm:w-28">
            {peer?.avatar ? (
              <img src={peer.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-extrabold text-slate-300 sm:text-4xl">
                {(peer?.name ?? '?').trim().slice(0, 1) || '?'}
              </span>
            )}
          </div>
          <h2 className="text-center text-lg font-extrabold tracking-tight sm:text-xl">{peer?.name ?? 'تماس'}</h2>
          {phase !== 'ended' ? (
            <>
              <p className="mt-1 text-center text-[15px] font-bold text-sky-300/95">{phaseHeadline}</p>
              {phaseHint ? (
                <p className="mt-2 max-w-[20rem] text-center text-[13px] leading-relaxed text-slate-400">
                  {phaseHint}
                </p>
              ) : null}
              {VOICE_CALL_DEBUG && (phase === 'connecting' || phase === 'active') ? (
                <pre className="mt-3 max-h-[min(50vh,22rem)] w-full max-w-[min(100%,24rem)] overflow-auto rounded border border-dashed border-amber-700/70 bg-black/55 p-2 text-left font-mono text-[9px] leading-tight text-amber-200/95 whitespace-pre-wrap break-words">
                  {voiceDebugText}
                  {voiceIceDbgText ? `\n${voiceIceDbgText}` : ''}
                </pre>
              ) : null}
            </>
          ) : (
            <p className="mt-3 max-w-[22rem] text-center text-[15px] font-semibold leading-relaxed text-slate-100">
              {endedReason ?? 'تماس پایان یافت.'}
            </p>
          )}

          <div className="mt-10 flex w-full max-w-sm flex-col items-stretch gap-3 sm:mt-12">
            <div className="flex flex-wrap items-center justify-center gap-4">
              {phase === 'incoming' ? (
                <>
                  <button
                    type="button"
                    onClick={() => rejectIncoming()}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-2xl shadow-lg transition hover:bg-red-700 active:scale-[0.98]"
                    aria-label="رد تماس"
                  >
                    ✕
                  </button>
                  <button
                    type="button"
                    onClick={() => acceptIncoming()}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-2xl shadow-lg transition hover:bg-emerald-600 active:scale-[0.98]"
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
                  className="flex h-16 min-w-[5.5rem] items-center justify-center rounded-full bg-red-600 px-5 text-sm font-extrabold shadow-lg transition hover:bg-red-700 active:scale-[0.98]"
                  aria-label="لغو تماس"
                >
                  لغو تماس
                </button>
              ) : null}

              {phase === 'active' ? (
                <>
                  <button
                    type="button"
                    onClick={() => toggleMute()}
                    className={`flex h-14 w-14 items-center justify-center rounded-full text-lg shadow-lg transition active:scale-[0.98] ${
                      muted ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                    aria-label={muted ? 'روشن کردن میکروفون' : 'بی‌صدا کردن میکروفون'}
                  >
                    {muted ? '🔇' : '🎤'}
                  </button>
                  <button
                    type="button"
                    onClick={() => hangup()}
                    className="flex h-16 min-w-[5.5rem] items-center justify-center rounded-full bg-red-600 px-5 text-sm font-extrabold shadow-lg transition hover:bg-red-700 active:scale-[0.98]"
                    aria-label="پایان تماس"
                  >
                    پایان تماس
                  </button>
                </>
              ) : null}
            </div>

            {phase === 'ended' ? (
              <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => retryLastCall()}
                  className="min-h-[48px] flex-1 rounded-xl bg-sky-600 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-sky-500 active:scale-[0.99] sm:flex-initial sm:px-8"
                >
                  تماس دوباره
                </button>
                <button
                  type="button"
                  onClick={() => dismissEnded()}
                  className="min-h-[48px] flex-1 rounded-xl border border-slate-600 bg-slate-800/80 py-3 text-sm font-extrabold text-slate-100 transition hover:bg-slate-800 active:scale-[0.99] sm:flex-initial sm:px-8"
                >
                  بستن
                </button>
              </div>
            ) : null}

            {phase === 'ended' ? (
              <p className="text-center text-[11px] text-slate-500">می‌توانید به گفتگو برگردید یا دوباره تماس بگیرید.</p>
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
