'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { useAppRealtime } from '@/context/AppRealtimeSocketContext';
import { fetchJoinToken, fetchMeeting, type JoinTokenResponse, type MeetingDetail } from '@/lib/meetings';

const MEETING_FULL_FA = 'در نسخه فعلی جلسات تا ۲ نفر پشتیبانی می‌شود';
const WAITING_PEER_FA = 'در انتظار ورود شرکت‌کننده دیگر';
const CONNECTING_FA = 'در حال اتصال…';
const REMOTE_VIDEO_UNAVAILABLE_FA = 'تصویر طرف مقابل در دسترس نیست';
const REMOTE_CAMERA_OFF_FA = 'دوربین طرف مقابل خاموش است';

function getMeetingBrowserDiagnostics() {
  if (typeof navigator === 'undefined') {
    return {
      userAgent: '',
      isIos: false,
      isSafari: false,
      needsUserGestureForGetUserMedia: false,
    };
  }
  const ua = navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|OPR|OPT|Android|wv/.test(ua);
  return {
    userAgent: ua,
    isIos,
    isSafari,
    needsUserGestureForGetUserMedia: isIos,
  };
}

async function acquireLocalMedia(): Promise<{
  stream: MediaStream;
  videoUnavailable: boolean;
  audioUnavailable: boolean;
}> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    return { stream, videoUnavailable: false, audioUnavailable: false };
  } catch {
    /* try partial */
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    return { stream, videoUnavailable: true, audioUnavailable: false };
  } catch {
    /* try video only */
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    return { stream, videoUnavailable: false, audioUnavailable: true };
  } catch (e) {
    throw e;
  }
}

type RoomParticipant = {
  id: string;
  name: string;
  avatar: string | null;
  username: string;
};

type RtcStage = 'waiting' | 'peer_joined' | 'negotiating' | 'ice_connecting' | 'connected' | 'failed';
type RosterPayload = {
  meetingId: string;
  reason: 'join' | 'leave' | 'disconnect';
  participants: RoomParticipant[];
  offererUserId: string | null;
};

export default function MeetingRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { socket, connected } = useAppRealtime();
  const id = typeof params?.id === 'string' ? params.id : '';

  const [m, setM] = useState<MeetingDetail | null>(null);
  const [join, setJoin] = useState<JoinTokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('در حال آماده‌سازی اتاق…');
  const [permissionDenied, setPermissionDenied] = useState(false);
  /** full | audio_only | video_only — partial permissions */
  const [mediaProfile, setMediaProfile] = useState<'full' | 'audio_only' | 'video_only'>('full');
  const [awaitingIosMediaTap, setAwaitingIosMediaTap] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const selfIdRef = useRef<string | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Array<{ userId: string; stream: MediaStream }>>([]);
  const [rtcStage, setRtcStage] = useState<RtcStage>('waiting');
  const [offererUserId, setOffererUserId] = useState<string | null>(null);
  const [rtcDebug, setRtcDebug] = useState({
    joinEmitted: false,
    offersCreated: 0,
    answersReceived: 0,
    remoteDescSet: 0,
    iceQueued: 0,
    iceApplied: 0,
    ontrackAudio: 0,
    ontrackVideo: 0,
  });

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const isSettingRemoteAnswerRef = useRef<Map<string, boolean>>(new Map());

  const isDev = process.env.NODE_ENV !== 'production';
  const logRtc = useCallback(
    (event: string, data?: Record<string, unknown>) => {
      if (!isDev) return;
      const suffix = data ? ` ${JSON.stringify(data)}` : '';
      console.debug(`[meeting-rtc:${id}] ${event}${suffix}`);
    },
    [id, isDev],
  );

  useEffect(() => {
    if (!isDev || typeof window === 'undefined') return;
    const d = getMeetingBrowserDiagnostics();
    logRtc('browser_diagnostics', d);
  }, [isDev, logRtc]);

  const participantCount = participants.length;

  const stopAndClearMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  }, []);

  const closeAllPeerConnections = useCallback(() => {
    for (const pc of pcsRef.current.values()) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
    }
    pcsRef.current.clear();
    pendingIceRef.current.clear();
    makingOfferRef.current.clear();
    isSettingRemoteAnswerRef.current.clear();
    remoteStreamsRef.current.clear();
    setRemoteStreams([]);
  }, []);

  const createPeerConnection = useCallback(
    (remoteUserId: string): RTCPeerConnection => {
      const existing = pcsRef.current.get(remoteUserId);
      if (existing && existing.signalingState !== 'closed') return existing;

      const pc = new RTCPeerConnection({
        iceServers: join?.iceServers ?? [],
      });
      pcsRef.current.set(remoteUserId, pc);

      const local = localStreamRef.current;
      if (local) {
        local.getTracks().forEach((track) => pc.addTrack(track, local));
      }

      pc.onicecandidate = (e) => {
        if (!e.candidate || !socket || !id) return;
        logRtc('emit_ice', { to: remoteUserId });
        socket.emit('meeting_signal', {
          meetingId: id,
          targetUserId: remoteUserId,
          type: 'ice-candidate',
          candidate: e.candidate.toJSON(),
        });
      };

      const logReceiversAndStream = (label: string, mediaStream: MediaStream) => {
        if (!isDev) return;
        logRtc(`receivers:${label}`, {
          peer: remoteUserId,
          receivers: pc.getReceivers().map((receiver) => ({
            kind: receiver.track.kind,
            readyState: receiver.track.readyState,
            muted: receiver.track.muted,
            enabled: receiver.track.enabled,
          })),
        });
        logRtc(`remote_stream:${label}`, {
          peer: remoteUserId,
          tracks: mediaStream.getTracks().map((t) => ({ kind: t.kind, id: t.id, readyState: t.readyState, muted: t.muted, enabled: t.enabled })),
          videoTracks: mediaStream.getVideoTracks().map((t) => ({ id: t.id, readyState: t.readyState, muted: t.muted, enabled: t.enabled })),
          audioTracks: mediaStream.getAudioTracks().map((t) => ({ id: t.id, readyState: t.readyState, muted: t.muted, enabled: t.enabled })),
        });
      };

      pc.ontrack = (e) => {
        logRtc('ontrack', {
          from: remoteUserId,
          kind: e.track.kind,
          trackState: e.track.readyState,
          streamTracks: e.streams[0]?.getTracks().map((t) => `${t.kind}:${t.readyState}`) ?? [],
        });
        setRtcDebug((d) => ({
          ...d,
          ontrackAudio: d.ontrackAudio + (e.track.kind === 'audio' ? 1 : 0),
          ontrackVideo: d.ontrackVideo + (e.track.kind === 'video' ? 1 : 0),
        }));
        const existing = remoteStreamsRef.current.get(remoteUserId);
        let mediaStream: MediaStream;
        if (existing) {
          mediaStream = existing;
          if (!existing.getTracks().some((t) => t.id === e.track.id)) {
            existing.addTrack(e.track);
          }
        } else {
          // One persistent MediaStream per remote peer; never swap to e.streams[0].
          mediaStream = new MediaStream();
          mediaStream.addTrack(e.track);
          remoteStreamsRef.current.set(remoteUserId, mediaStream);
        }
        logReceiversAndStream('ontrack', mediaStream);
        setRtcStage('connected');
        setRemoteStreams(Array.from(remoteStreamsRef.current.entries()).map(([userId, s]) => ({ userId, stream: s })));
      };

      const handleDisconnect = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
          pc.close();
          pcsRef.current.delete(remoteUserId);
          pendingIceRef.current.delete(remoteUserId);
          makingOfferRef.current.delete(remoteUserId);
          isSettingRemoteAnswerRef.current.delete(remoteUserId);
          remoteStreamsRef.current.delete(remoteUserId);
          setRemoteStreams(Array.from(remoteStreamsRef.current.entries()).map(([userId, s]) => ({ userId, stream: s })));
        }
      };
      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        logRtc('pc_connection_state', { peer: remoteUserId, state: st });
        if (st === 'connecting') setRtcStage('ice_connecting');
        if (st === 'connected') setRtcStage('connected');
        if (st === 'failed' || st === 'disconnected') setRtcStage('failed');
        handleDisconnect();
      };
      pc.oniceconnectionstatechange = () => {
        const st = pc.iceConnectionState;
        logRtc('pc_ice_state', { peer: remoteUserId, state: st });
        if (st === 'checking') setRtcStage('ice_connecting');
        if (st === 'connected' || st === 'completed') setRtcStage('connected');
        if (st === 'failed' || st === 'disconnected') setRtcStage('failed');
        handleDisconnect();
      };

      return pc;
    },
    [id, isDev, join?.iceServers, logRtc, socket],
  );

  const createOfferTo = useCallback(
    async (remoteUserId: string) => {
      try {
        const pc = createPeerConnection(remoteUserId);
        const makingOffer = makingOfferRef.current.get(remoteUserId) === true;
        if (makingOffer) return;
        if (pc.signalingState !== 'stable') return;
        makingOfferRef.current.set(remoteUserId, true);
        setRtcStage('negotiating');
        logRtc('create_offer', { to: remoteUserId, signaling: pc.signalingState });
        setRtcDebug((d) => ({ ...d, offersCreated: d.offersCreated + 1 }));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (!socket || !id) return;
        socket.emit('meeting_signal', {
          meetingId: id,
          targetUserId: remoteUserId,
          type: 'offer',
          sdp: offer.sdp,
        });
        logRtc('emit_offer', { to: remoteUserId });
      } catch {
        setError('ایجاد اتصال به شرکت‌کننده انجام نشد.');
      } finally {
        makingOfferRef.current.set(remoteUserId, false);
      }
    },
    [createPeerConnection, id, logRtc, socket],
  );

  const attachLocalMedia = useCallback(async () => {
    setStatusText('در حال دریافت دسترسی میکروفون/دوربین…');
    try {
      const { stream, videoUnavailable, audioUnavailable } = await acquireLocalMedia();
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      if (videoUnavailable && !audioUnavailable) {
        setMediaProfile('audio_only');
        setCamOn(false);
        setMicOn(true);
        stream.getAudioTracks().forEach((t) => {
          t.enabled = true;
        });
        stream.getVideoTracks().forEach((t) => {
          t.enabled = false;
        });
      } else if (audioUnavailable && !videoUnavailable) {
        setMediaProfile('video_only');
        setMicOn(false);
        setCamOn(true);
        stream.getVideoTracks().forEach((t) => {
          t.enabled = true;
        });
      } else {
        setMediaProfile('full');
        setMicOn(true);
        setCamOn(true);
        stream.getAudioTracks().forEach((t) => {
          t.enabled = true;
        });
        stream.getVideoTracks().forEach((t) => {
          t.enabled = true;
        });
      }

      setAwaitingIosMediaTap(false);
      setMediaReady(true);
      setStatusText('اتصال به اتاق…');
    } catch (e) {
      const err = e instanceof Error ? e : null;
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
      }
      setError(err?.message ?? 'خطا');
      setM(null);
      setJoin(null);
      setMediaReady(false);
      setAwaitingIosMediaTap(false);
      setRtcStage('waiting');
      setParticipants([]);
      setSelfId(null);
      selfIdRef.current = null;
      stopAndClearMedia();
      closeAllPeerConnections();
    }
  }, [closeAllPeerConnections, stopAndClearMedia]);

  const fetchRoomAndMaybeMedia = useCallback(async () => {
    if (!id) return;
    setError(null);
    setPermissionDenied(false);
    setMediaProfile('full');
    try {
      const [detail, tok] = await Promise.all([fetchMeeting(id), fetchJoinToken(id)]);
      setM(detail);
      setJoin(tok);
      const { needsUserGestureForGetUserMedia } = getMeetingBrowserDiagnostics();
      if (needsUserGestureForGetUserMedia) {
        setAwaitingIosMediaTap(true);
        setStatusText('برای فعال‌سازی دوربین و میکروفون، «شروع جلسه» را بزنید');
        return;
      }
      await attachLocalMedia();
    } catch (e) {
      const err = e instanceof Error ? e : null;
      setError(err?.message ?? 'خطا');
      setM(null);
      setJoin(null);
      setMediaReady(false);
      setRtcStage('waiting');
      setParticipants([]);
      setSelfId(null);
      selfIdRef.current = null;
      stopAndClearMedia();
      closeAllPeerConnections();
    }
  }, [attachLocalMedia, closeAllPeerConnections, id, stopAndClearMedia]);

  useEffect(() => {
    void fetchRoomAndMaybeMedia();
    return () => {
      if (socket && id) socket.emit('meeting_leave', { meetingId: id });
      closeAllPeerConnections();
      stopAndClearMedia();
      setMediaReady(false);
      setParticipants([]);
      setSelfId(null);
      selfIdRef.current = null;
    };
  }, [closeAllPeerConnections, fetchRoomAndMaybeMedia, id, socket, stopAndClearMedia]);

  useEffect(() => {
    if (!socket || !connected || !id || !join?.token || !mediaReady || !localStreamRef.current) return;

    let mounted = true;
    setStatusText(CONNECTING_FA);

    socket.emit(
      'meeting_join',
      { meetingId: id, joinToken: join.token },
      async (ack: {
        ok?: boolean;
        code?: string;
        message?: string;
        self?: RoomParticipant;
        participants?: RoomParticipant[];
      }) => {
        if (!mounted) return;
        if (!ack?.ok || !ack.self) {
          const msg =
            ack?.code === 'MEETING_FULL' ? (ack.message ?? MEETING_FULL_FA) : 'پیوستن به اتاق انجام نشد.';
          setError(msg);
          setStatusText(ack?.code === 'MEETING_FULL' ? MEETING_FULL_FA : 'خطا در پیوستن');
          return;
        }
        const self = ack.self;
        setSelfId(self.id);
        selfIdRef.current = self.id;
        const list = Array.isArray(ack.participants) ? ack.participants : [self];
        setParticipants(list);
        setStatusText('اتاق آماده است');
        if (list.some((p) => p.id !== self.id)) {
          setRtcStage('peer_joined');
        }
      },
    );
    setRtcDebug((d) => ({ ...d, joinEmitted: true }));

    const onParticipantJoined = async (payload: { meetingId: string; participant: RoomParticipant }) => {
      if (payload.meetingId !== id) return;
      if (payload.participant.id === selfIdRef.current) return;
      setParticipants((prev) => {
        if (prev.some((x) => x.id === payload.participant.id)) return prev;
        return [...prev, payload.participant];
      });
      setRtcStage((prev) => (prev === 'connected' ? prev : 'peer_joined'));
    };

    const onParticipantLeft = (payload: { meetingId: string; userId: string }) => {
      if (payload.meetingId !== id) return;
      setParticipants((prev) => prev.filter((x) => x.id !== payload.userId));
      const pc = pcsRef.current.get(payload.userId);
      if (pc) {
        pc.close();
        pcsRef.current.delete(payload.userId);
      }
      remoteStreamsRef.current.delete(payload.userId);
      setRemoteStreams(Array.from(remoteStreamsRef.current.entries()).map(([userId, stream]) => ({ userId, stream })));
    };

    const onSignal = async (payload: {
      meetingId: string;
      fromUserId: string;
      targetUserId: string | null;
      type: string;
      sdp?: string;
      candidate?: RTCIceCandidateInit;
    }) => {
      if (payload.meetingId !== id) return;
      const sid = selfIdRef.current;
      if (sid && payload.targetUserId && payload.targetUserId !== sid) return;
      if (!sid || payload.fromUserId === sid) return;
      setRtcStage((prev) => (prev === 'connected' ? prev : 'negotiating'));
      const pc = createPeerConnection(payload.fromUserId);
      try {
        if (payload.type === 'offer' && payload.sdp) {
          const makingOffer = makingOfferRef.current.get(payload.fromUserId) === true;
          const settingRemote = isSettingRemoteAnswerRef.current.get(payload.fromUserId) === true;
          const offerCollision = makingOffer || pc.signalingState !== 'stable' || settingRemote;
          const polite = sid > payload.fromUserId;
          if (offerCollision && !polite) {
            logRtc('drop_offer_impolite_collision', { from: payload.fromUserId });
            return;
          }
          if (offerCollision && polite) {
            logRtc('rollback_on_collision', { from: payload.fromUserId });
            await Promise.all([pc.setLocalDescription({ type: 'rollback' }), pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp })]);
          } else {
            await pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp });
          }
          logRtc('set_remote_offer', { from: payload.fromUserId });
          setRtcDebug((d) => ({ ...d, remoteDescSet: d.remoteDescSet + 1 }));
          const pending = pendingIceRef.current.get(payload.fromUserId) ?? [];
          for (const c of pending) {
            await pc.addIceCandidate(c);
            setRtcDebug((d) => ({ ...d, iceApplied: d.iceApplied + 1 }));
          }
          pendingIceRef.current.delete(payload.fromUserId);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          logRtc('emit_answer', { to: payload.fromUserId });
          socket.emit('meeting_signal', {
            meetingId: id,
            targetUserId: payload.fromUserId,
            type: 'answer',
            sdp: answer.sdp,
          });
          return;
        }
        if (payload.type === 'answer' && payload.sdp) {
          isSettingRemoteAnswerRef.current.set(payload.fromUserId, true);
          await pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
          logRtc('set_remote_answer', { from: payload.fromUserId });
          setRtcDebug((d) => ({
            ...d,
            answersReceived: d.answersReceived + 1,
            remoteDescSet: d.remoteDescSet + 1,
          }));
          const pending = pendingIceRef.current.get(payload.fromUserId) ?? [];
          for (const c of pending) {
            await pc.addIceCandidate(c);
            setRtcDebug((d) => ({ ...d, iceApplied: d.iceApplied + 1 }));
          }
          pendingIceRef.current.delete(payload.fromUserId);
          isSettingRemoteAnswerRef.current.set(payload.fromUserId, false);
          return;
        }
        if (payload.type === 'ice-candidate' && payload.candidate) {
          if (!pc.remoteDescription) {
            const q = pendingIceRef.current.get(payload.fromUserId) ?? [];
            q.push(payload.candidate);
            pendingIceRef.current.set(payload.fromUserId, q);
            logRtc('queue_ice', { from: payload.fromUserId, count: q.length });
            setRtcDebug((d) => ({ ...d, iceQueued: d.iceQueued + 1 }));
            return;
          }
          await pc.addIceCandidate(payload.candidate);
          logRtc('apply_ice', { from: payload.fromUserId });
          setRtcDebug((d) => ({ ...d, iceApplied: d.iceApplied + 1 }));
        }
      } catch {
        setError('سیگنال WebRTC نامعتبر بود.');
        setRtcStage('failed');
      } finally {
        isSettingRemoteAnswerRef.current.set(payload.fromUserId, false);
      }
    };

    const onRoster = async (payload: RosterPayload) => {
      if (payload.meetingId !== id) return;
      const sid = selfIdRef.current;
      if (!sid) return;
      setParticipants(payload.participants ?? []);
      setOffererUserId(payload.offererUserId ?? null);
      const remotes = (payload.participants ?? []).filter((p) => p.id !== sid);
      if (remotes.length === 0) {
        setRtcStage('waiting');
        return;
      }
      setRtcStage((prev) => (prev === 'connected' ? prev : 'peer_joined'));
      if (payload.offererUserId === sid) {
        for (const p of remotes) {
          await createOfferTo(p.id);
        }
      }
    };

    socket.on('meeting_participant_joined', onParticipantJoined);
    socket.on('meeting_participant_left', onParticipantLeft);
    socket.on('meeting_signal', onSignal);
    socket.on('meeting_roster', onRoster);

    return () => {
      mounted = false;
      socket.emit('meeting_leave', { meetingId: id });
      socket.off('meeting_participant_joined', onParticipantJoined);
      socket.off('meeting_participant_left', onParticipantLeft);
      socket.off('meeting_signal', onSignal);
      socket.off('meeting_roster', onRoster);
    };
  }, [connected, createOfferTo, createPeerConnection, id, join?.token, logRtc, mediaReady, socket]);

  const remotes = useMemo(
    () =>
      remoteStreams.map((x) => {
        const p = participants.find((k) => k.id === x.userId);
        return { ...x, participant: p ?? null };
      }),
    [participants, remoteStreams],
  );

  function toggleMic() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !micOn;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
    setMicOn(next);
  }

  function toggleCamera() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !camOn;
    stream.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
    setCamOn(next);
  }

  function leaveRoom() {
    if (socket && id) socket.emit('meeting_leave', { meetingId: id });
    closeAllPeerConnections();
    stopAndClearMedia();
    setMediaReady(false);
    setRtcStage('waiting');
    setParticipants([]);
    setSelfId(null);
    selfIdRef.current = null;
    router.push(id ? `/meetings/${id}` : '/spaces/education');
  }

  const remoteParticipants = useMemo(
    () => participants.filter((p) => p.id !== selfId),
    [participants, selfId],
  );
  const remoteMediaSummary = useMemo(
    () =>
      remoteStreams.map((r) => ({
        userId: r.userId,
        audio: r.stream.getAudioTracks().filter((t) => t.readyState === 'live').length,
        video: r.stream.getVideoTracks().filter((t) => t.readyState === 'live').length,
      })),
    [remoteStreams],
  );

  useEffect(() => {
    if (permissionDenied) {
      setStatusText(
        'اجازهٔ میکروفون و دوربین داده نشد. در تنظیمات مرورگر (آیکون قفل کنار نوار آدرس) برای این سایت هر دو را مجاز کنید.',
      );
      return;
    }
    if (!join || !localStreamRef.current) return;
    if (remoteStreams.length > 0 || rtcStage === 'connected') {
      const names = remoteParticipants.map((p) => p.name).filter(Boolean);
      setStatusText(names.length ? `متصل: ${names.join('، ')}` : 'متصل');
      return;
    }
    if (remoteParticipants.length > 0 || rtcStage === 'peer_joined' || rtcStage === 'negotiating' || rtcStage === 'ice_connecting') {
      setStatusText(CONNECTING_FA);
      return;
    }
    if (rtcStage === 'failed') {
      setStatusText('اتصال پایدار نشد');
      return;
    }
    setStatusText(WAITING_PEER_FA);
  }, [join, permissionDenied, remoteParticipants, remoteStreams.length, rtcStage]);

  return (
    <AuthGate>
      <div className="flex min-h-[calc(100vh-8rem)] flex-col bg-[var(--surface-strong)]">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-soft)] bg-[var(--card-bg)] px-3 py-2">
          <Link href={id ? `/meetings/${id}` : '/spaces/education'} className="text-[12px] font-bold text-[var(--text-secondary)]">
            ← جزئیات
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-xs font-extrabold text-[var(--text-primary)]">{m?.title ?? 'اتاق جلسه'}</p>
            <p className="text-[10px] text-[var(--text-secondary)]">{participantCount} شرکت‌کننده</p>
            <p className="text-[10px] text-[var(--text-secondary)]">{statusText}</p>
          </div>
          <span className="w-10" aria-hidden />
        </header>

        {error ? (
          <div className="m-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        ) : null}

        {awaitingIosMediaTap && join && !mediaReady ? (
          <div className="mx-3 mt-3 flex flex-col items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 ring-1 ring-[var(--border-soft)]">
            <p className="text-center text-sm text-[var(--text-primary)]">
              در iOS برای دسترسی به دوربین و میکروفون باید یک بار ضربه بزنید.
            </p>
            <button
              type="button"
              onClick={() => void attachLocalMedia()}
              className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-extrabold text-white shadow-md active:scale-[0.98]"
            >
              شروع جلسه
            </button>
          </div>
        ) : null}

        {permissionDenied ? (
          <div className="mx-3 mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-200">
            دسترسی به میکروفون و دوربین داده نشد. در تنظیمات Safari، بخش حریم خصوصی، میکروفون و دوربین را بررسی کنید یا از نوار آدرس مجوز سایت را بدهید.
          </div>
        ) : null}

        {!permissionDenied && mediaProfile === 'audio_only' ? (
          <div className="mx-3 mt-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-800 dark:text-sky-200">
            دوربین فعال نشد؛ جلسه فقط با صدا ادامه دارد. برای تصویر، در تنظیمات مرورگر اجازهٔ دوربین را برای این سایت بدهید.
          </div>
        ) : null}

        {!permissionDenied && mediaProfile === 'video_only' ? (
          <div className="mx-3 mt-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-800 dark:text-sky-200">
            میکروفون فعال نشد؛ جلسه فقط با تصویر ادامه دارد. برای صدا، در تنظیمات مرورگر اجازهٔ میکروفون را برای این سایت بدهید.
          </div>
        ) : null}

        <div className="flex flex-1 flex-col gap-3 p-3 pb-28">
          <div className="aspect-video w-full overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-zinc-900 shadow-inner ring-1 ring-black/20">
            <video
              ref={localVideoRef}
              className="h-full w-full object-cover"
              autoPlay
              muted
              playsInline
              controls={false}
            />
          </div>

          <div className="min-h-[120px] flex-1 rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--card-bg)] p-2 ring-1 ring-[var(--border-soft)]">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">سایر شرکت‌کنندگان</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {remoteParticipants.length > 0
                ? remoteParticipants.map((p) => {
                    const remote = remotes.find((r) => r.userId === p.id);
                    if (remote) {
                      return <RemoteTile key={p.id} stream={remote.stream} title={p.name} avatarUrl={p.avatar} />;
                    }
                    return (
                      <div
                        key={p.id}
                        className="flex aspect-video items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[10px] text-[var(--text-secondary)] ring-1 ring-[var(--border-soft)]"
                      >
                        {`${CONNECTING_FA} (${p.name})`}
                      </div>
                    );
                  })
                : (
                  <div className="col-span-2 flex aspect-video items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[10px] text-[var(--text-secondary)] ring-1 ring-[var(--border-soft)] sm:col-span-3">
                    {WAITING_PEER_FA}
                  </div>
                )}
            </div>
          </div>
        </div>

        {join && process.env.NODE_ENV === 'development' ? (
          <div className="space-y-1 px-3 pb-2">
            <p className="text-[9px] font-mono text-[var(--text-secondary)] opacity-70">
              {`dev: iceServers=${join.iceServers.length} token=${join.token.length} stage=${rtcStage} self=${selfId ?? '-'} offerer=${offererUserId ?? '-'}`}
            </p>
            <pre className="max-h-36 overflow-auto rounded border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2 text-[9px] font-mono text-[var(--text-secondary)]">
              {JSON.stringify(
                {
                  joinEmitted: rtcDebug.joinEmitted,
                  participants: participants.length,
                  remoteParticipants: remoteParticipants.length,
                  offersCreated: rtcDebug.offersCreated,
                  answersReceived: rtcDebug.answersReceived,
                  remoteDescSet: rtcDebug.remoteDescSet,
                  iceQueued: rtcDebug.iceQueued,
                  iceApplied: rtcDebug.iceApplied,
                  ontrackAudio: rtcDebug.ontrackAudio,
                  ontrackVideo: rtcDebug.ontrackVideo,
                  remoteMediaSummary,
                  browser:
                    typeof navigator !== 'undefined' ? getMeetingBrowserDiagnostics() : null,
                },
                null,
                2,
              )}
            </pre>
          </div>
        ) : null}

        <footer className="sticky bottom-0 z-10 border-t border-[var(--border-soft)] bg-[var(--card-bg)]/95 px-3 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center justify-center gap-3">
            <button
              type="button"
              onClick={toggleMic}
              className={`flex h-12 w-12 items-center justify-center rounded-full text-lg shadow-md ${
                micOn ? 'bg-zinc-700 text-white' : 'bg-red-600 text-white'
              }`}
              aria-label="میکروفون"
            >
              {micOn ? '🎙' : '🔇'}
            </button>
            <button
              type="button"
              onClick={toggleCamera}
              className={`flex h-12 w-12 items-center justify-center rounded-full text-lg shadow-md ${
                camOn ? 'bg-zinc-700 text-white' : 'bg-zinc-600 text-white'
              }`}
              aria-label="دوربین"
            >
              {camOn ? '📹' : '🚫'}
            </button>
            <button
              type="button"
              onClick={leaveRoom}
              className="flex h-12 min-w-[4.5rem] items-center justify-center rounded-full bg-red-600 px-4 text-xs font-extrabold text-white shadow-md"
            >
              خروج
            </button>
          </div>
        </footer>
      </div>
    </AuthGate>
  );
}

function RemoteTile({
  stream,
  title,
  avatarUrl,
}: {
  stream: MediaStream;
  title: string;
  avatarUrl: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [trackVersion, setTrackVersion] = useState(0);
  const [hasLiveVideo, setHasLiveVideo] = useState(false);
  const [remoteCameraMuted, setRemoteCameraMuted] = useState(false);
  const [videoFrameReady, setVideoFrameReady] = useState(false);
  const [noFramesOverlay, setNoFramesOverlay] = useState(false);

  const hasLiveAudio = useMemo(
    () => stream.getAudioTracks().some((t) => t.readyState === 'live'),
    [stream, trackVersion],
  );

  const pruneEndedTracks = useCallback(() => {
    for (const t of [...stream.getTracks()]) {
      if (t.readyState === 'ended') {
        stream.removeTrack(t);
      }
    }
  }, [stream]);

  const inspectVideo = useCallback(() => {
    pruneEndedTracks();
    const tracks = stream.getVideoTracks();
    const live = tracks.find((t) => t.readyState === 'live');
    setHasLiveVideo(!!live);
    setRemoteCameraMuted(!!live && live.muted);
  }, [pruneEndedTracks, stream]);

  const tryPlayVideo = useCallback(async () => {
    const el = videoRef.current;
    if (!el || !hasLiveVideo) return;
    try {
      await el.play();
    } catch {
      /* autoplay policy / transient; handlers retry */
    }
  }, [hasLiveVideo]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void tryPlayVideo();
    };
    const onPageShow = () => void tryPlayVideo();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [tryPlayVideo]);

  useEffect(() => {
    const onTrackShapeChange = () => setTrackVersion((v) => v + 1);
    stream.addEventListener('addtrack', onTrackShapeChange);
    stream.addEventListener('removetrack', onTrackShapeChange);
    return () => {
      stream.removeEventListener('addtrack', onTrackShapeChange);
      stream.removeEventListener('removetrack', onTrackShapeChange);
    };
  }, [stream]);

  useEffect(() => {
    inspectVideo();
    const onChange = () => {
      pruneEndedTracks();
      inspectVideo();
      setTrackVersion((v) => v + 1);
    };
    const tracks = stream.getVideoTracks();
    for (const t of tracks) {
      t.addEventListener('mute', onChange);
      t.addEventListener('unmute', onChange);
      t.addEventListener('ended', onChange);
    }
    return () => {
      for (const t of tracks) {
        t.removeEventListener('mute', onChange);
        t.removeEventListener('unmute', onChange);
        t.removeEventListener('ended', onChange);
      }
    };
  }, [inspectVideo, pruneEndedTracks, stream, trackVersion]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !hasLiveVideo) {
      if (el) el.srcObject = null;
      setVideoFrameReady(false);
      setNoFramesOverlay(false);
      return;
    }
    const videoTracks = stream.getVideoTracks().filter((t) => t.readyState === 'live');
    const videoOnly = new MediaStream(videoTracks);
    el.srcObject = null;
    el.srcObject = videoOnly;
    setVideoFrameReady(false);
    void (async () => {
      try {
        await el.play();
      } catch {
        /* see tryPlayVideo / event handlers */
      }
    })();
    return () => {
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [hasLiveVideo, stream, trackVersion]);

  useEffect(() => {
    if (!hasLiveVideo || !hasLiveAudio || videoFrameReady) {
      setNoFramesOverlay(false);
      return;
    }
    const t = window.setTimeout(() => {
      const v = videoRef.current;
      if (v && v.videoWidth === 0 && v.videoHeight === 0) setNoFramesOverlay(true);
    }, 2800);
    return () => window.clearTimeout(t);
  }, [hasLiveAudio, hasLiveVideo, trackVersion, videoFrameReady]);

  useEffect(() => {
    if (!audioRef.current) return;
    const audioTracks = stream.getAudioTracks().filter((t) => t.readyState === 'live');
    const audioOnly = new MediaStream(audioTracks);
    audioRef.current.srcObject = audioOnly;
    const p = audioRef.current.play();
    if (p !== undefined) {
      void p.catch(() => {
        /* autoplay restrictions can block; user interactions (toggles/leave) typically unlock */
      });
    }
    return () => {
      if (audioRef.current) audioRef.current.srcObject = null;
    };
  }, [stream, trackVersion]);

  const initial = title.trim().charAt(0) || '?';

  const showAudioOnlyPlaceholder = !hasLiveVideo && hasLiveAudio;

  return (
    <div className="relative overflow-hidden rounded-xl bg-black ring-1 ring-[var(--border-soft)]">
      {hasLiveVideo ? (
        <>
          <video
            ref={videoRef}
            className="aspect-video w-full object-cover"
            autoPlay
            playsInline
            muted={false}
            controls={false}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              setVideoFrameReady(v.videoWidth > 0 && v.videoHeight > 0);
              void tryPlayVideo();
            }}
            onCanPlay={() => void tryPlayVideo()}
            onPlaying={(e) => {
              const v = e.currentTarget;
              if (v.videoWidth > 0 && v.videoHeight > 0) setVideoFrameReady(true);
            }}
          />
          {noFramesOverlay && hasLiveAudio ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-2 text-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-white/30" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-600 text-lg font-bold text-white ring-2 ring-white/30">
                  {initial}
                </div>
              )}
              <span className="text-[11px] font-bold text-white">{REMOTE_VIDEO_UNAVAILABLE_FA}</span>
            </div>
          ) : null}
        </>
      ) : showAudioOnlyPlaceholder ? (
        <div className="relative flex aspect-video w-full flex-col items-center justify-center gap-2 bg-[var(--surface-soft)] px-2 text-center text-[10px] text-[var(--text-secondary)]">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-[var(--border-soft)]" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-600 text-lg font-bold text-white ring-2 ring-[var(--border-soft)]">
              {initial}
            </div>
          )}
          <span className="font-bold text-[var(--text-primary)]">{REMOTE_VIDEO_UNAVAILABLE_FA}</span>
        </div>
      ) : (
        <div className="relative flex aspect-video w-full flex-col items-center justify-center gap-2 bg-[var(--surface-soft)] text-[10px] text-[var(--text-secondary)]">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-[var(--border-soft)]" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-600 text-lg font-bold text-white ring-2 ring-[var(--border-soft)]">
              {initial}
            </div>
          )}
          <span className="text-center font-bold text-[var(--text-primary)]">{CONNECTING_FA}</span>
        </div>
      )}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      {hasLiveVideo && remoteCameraMuted ? (
        <div className="pointer-events-none absolute left-1 top-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {REMOTE_CAMERA_OFF_FA}
        </div>
      ) : null}
      <div className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">
        {title}
      </div>
    </div>
  );
}
