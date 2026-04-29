'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { useAppRealtime } from '@/context/AppRealtimeSocketContext';
import { fetchJoinToken, fetchMeeting, fetchMeetingChat, type JoinTokenResponse, type MeetingDetail } from '@/lib/meetings';

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

type LocalMeetingChatMessage = {
  id: string;
  senderId: string | null;
  senderName: string;
  text: string;
  at: Date;
};

type LocalReactionBurst = {
  id: string;
  emoji: string;
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
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const selfIdRef = useRef<string | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Array<{ userId: string; stream: MediaStream }>>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [chatMessages, setChatMessages] = useState<LocalMeetingChatMessage[]>([]);
  const [reactionBursts, setReactionBursts] = useState<LocalReactionBurst[]>([]);
  const [screenShareNotice, setScreenShareNotice] = useState<string | null>(null);
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
  const [localPreviewStream, setLocalPreviewStream] = useState<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const disconnectCleanupTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const isSettingRemoteAnswerRef = useRef<Map<string, boolean>>(new Map());
  const iceRestartTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const logRtc = useCallback(
    (event: string, data?: Record<string, unknown>) => {
      const suffix = data ? ` ${JSON.stringify(data)}` : '';
      console.debug(`[mtg:${id}] ${event}${suffix}`);
    },
    [id],
  );

  const participantCount = participants.length;
  const SELF_REACTIONS = ['👍', '👏', '😂', '❤️', '✋'];

  const upsertChatMessage = useCallback((msg: LocalMeetingChatMessage) => {
    setChatMessages((prev) => {
      if (prev.some((x) => x.id === msg.id)) return prev;
      return [...prev, msg].sort((a, b) => a.at.getTime() - b.at.getTime());
    });
  }, []);

  const stopAndClearMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalPreviewStream(null);
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
    for (const t of iceRestartTimersRef.current.values()) {
      clearTimeout(t);
    }
    for (const t of disconnectCleanupTimersRef.current.values()) {
      clearTimeout(t);
    }
    iceRestartTimersRef.current.clear();
    disconnectCleanupTimersRef.current.clear();
    pcsRef.current.clear();
    pendingIceRef.current.clear();
    makingOfferRef.current.clear();
    isSettingRemoteAnswerRef.current.clear();
    remoteStreamsRef.current.clear();
    setRemoteStreams([]);
  }, []);

  const emitMeetingSignalWithAck = useCallback(
    async (payload: {
      meetingId: string;
      targetUserId: string;
      type: 'offer' | 'answer' | 'ice-candidate';
      sdp?: string;
      candidate?: RTCIceCandidateInit;
    }) => {
      if (!socket) return false;
      const sendOnce = () =>
        new Promise<boolean>((resolve) => {
          let done = false;
          const timer = window.setTimeout(() => {
            if (done) return;
            done = true;
            resolve(false);
          }, 3000);
          socket.emit(
            'meeting_signal',
            payload,
            (ack?: { ok?: boolean; code?: string; message?: string }) => {
              if (done) return;
              done = true;
              window.clearTimeout(timer);
              resolve(ack?.ok === true);
            },
          );
        });
      const first = await sendOnce();
      if (first) return true;
      await new Promise((r) => window.setTimeout(r, 1000));
      const second = await sendOnce();
      if (!second) {
        logRtc('signal-no-ack', { type: payload.type, to: payload.targetUserId });
      }
      return second;
    },
    [logRtc, socket],
  );

  const createPeerConnection = useCallback(
    (remoteUserId: string): RTCPeerConnection => {
      const existing = pcsRef.current.get(remoteUserId);
      if (existing && existing.signalingState !== 'closed') return existing;

      const pc = new RTCPeerConnection({
        iceServers: join?.iceServers ?? [],
      });
      pcsRef.current.set(remoteUserId, pc);
      logRtc('pc-created', { peer: remoteUserId, iceServers: join?.iceServers?.length ?? 0 });

      const local = localStreamRef.current;
      const hasLocalVideo =
        !!local && local.getVideoTracks().some((track) => track.readyState === 'live');
      if (!hasLocalVideo) {
        pc.addTransceiver('video', { direction: 'recvonly' });
        logRtc('pc-add-recvonly-video', { peer: remoteUserId });
      }
      if (local) {
        local.getTracks().forEach((track) => pc.addTrack(track, local));
      }

      pc.onicecandidate = (e) => {
        if (!e.candidate || !socket || !id) return;
        logRtc('signal-out', {
          type: 'ice-candidate',
          to: remoteUserId,
          candidateType: e.candidate.type,
        });
        void emitMeetingSignalWithAck({
          meetingId: id,
          targetUserId: remoteUserId,
          type: 'ice-candidate',
          candidate: e.candidate.toJSON(),
        });
      };

      const logReceiversAndStream = (label: string, mediaStream: MediaStream) => {
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
        if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
          pc.close();
          pcsRef.current.delete(remoteUserId);
          pendingIceRef.current.delete(remoteUserId);
          makingOfferRef.current.delete(remoteUserId);
          isSettingRemoteAnswerRef.current.delete(remoteUserId);
          remoteStreamsRef.current.delete(remoteUserId);
          const restartTimer = iceRestartTimersRef.current.get(remoteUserId);
          if (restartTimer) {
            clearTimeout(restartTimer);
            iceRestartTimersRef.current.delete(remoteUserId);
          }
          const disconnectTimer = disconnectCleanupTimersRef.current.get(remoteUserId);
          if (disconnectTimer) {
            clearTimeout(disconnectTimer);
            disconnectCleanupTimersRef.current.delete(remoteUserId);
          }
          setRemoteStreams(Array.from(remoteStreamsRef.current.entries()).map(([userId, s]) => ({ userId, stream: s })));
        }
      };
      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        logRtc('pc_connection_state', { peer: remoteUserId, state: st });
        if (st === 'connecting') setRtcStage('ice_connecting');
        if (st === 'connected') {
          setRtcStage('connected');
          const existing = disconnectCleanupTimersRef.current.get(remoteUserId);
          if (existing) {
            clearTimeout(existing);
            disconnectCleanupTimersRef.current.delete(remoteUserId);
          }
        }
        if (st === 'disconnected') {
          setRtcStage('ice_connecting');
          const existing = disconnectCleanupTimersRef.current.get(remoteUserId);
          if (existing) clearTimeout(existing);
          const timer = setTimeout(() => {
            disconnectCleanupTimersRef.current.delete(remoteUserId);
            if (
              pc.connectionState === 'disconnected' ||
              pc.connectionState === 'failed' ||
              pc.iceConnectionState === 'failed'
            ) {
              logRtc('pc_disconnect_grace_expired', { peer: remoteUserId, state: pc.connectionState, ice: pc.iceConnectionState });
              handleDisconnect();
            }
          }, 6500);
          disconnectCleanupTimersRef.current.set(remoteUserId, timer);
        }
        if (st === 'failed') setRtcStage('failed');
        handleDisconnect();
      };
      pc.oniceconnectionstatechange = () => {
        const st = pc.iceConnectionState;
        logRtc('pc_ice_state', { peer: remoteUserId, state: st });
        if (st === 'checking') setRtcStage('ice_connecting');
        if (st === 'connected' || st === 'completed') setRtcStage('connected');
        if (st === 'connected' || st === 'completed' || st === 'closed') {
          const existing = iceRestartTimersRef.current.get(remoteUserId);
          if (existing) {
            clearTimeout(existing);
            iceRestartTimersRef.current.delete(remoteUserId);
          }
        }
        if (st === 'failed') {
          setRtcStage('failed');
          try {
            pc.restartIce();
            logRtc('restart-ice-attempt', { peer: remoteUserId });
            const existing = iceRestartTimersRef.current.get(remoteUserId);
            if (existing) clearTimeout(existing);
            const timer = setTimeout(() => {
              iceRestartTimersRef.current.delete(remoteUserId);
              if (pc.iceConnectionState === 'failed') {
                logRtc('ice-restart-give-up', { peer: remoteUserId });
                pc.close();
              }
            }, 5000);
            iceRestartTimersRef.current.set(remoteUserId, timer);
          } catch {
            logRtc('restart-ice-failed', { peer: remoteUserId });
          }
        }
        if (st === 'disconnected') setRtcStage('ice_connecting');
        handleDisconnect();
      };

      return pc;
    },
    [emitMeetingSignalWithAck, id, join?.iceServers, logRtc, socket],
  );

  const createOfferTo = useCallback(
    async (remoteUserId: string) => {
      try {
        const pc = createPeerConnection(remoteUserId);
        const makingOffer = makingOfferRef.current.get(remoteUserId) === true;
        if (makingOffer) return;
        if (pc.localDescription?.type === 'offer') return;
        if (pc.signalingState !== 'stable') return;
        makingOfferRef.current.set(remoteUserId, true);
        setRtcStage('negotiating');
        logRtc('create_offer', { to: remoteUserId, signaling: pc.signalingState });
        setRtcDebug((d) => ({ ...d, offersCreated: d.offersCreated + 1 }));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (!socket || !id) return;
        logRtc('signal-out', {
          type: 'offer',
          to: remoteUserId,
          sdpLen: offer.sdp?.length ?? 0,
        });
        await emitMeetingSignalWithAck({
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
    [createPeerConnection, emitMeetingSignalWithAck, id, logRtc, socket],
  );

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    setPermissionDenied(false);
    try {
      const [detail, tok] = await Promise.all([fetchMeeting(id), fetchJoinToken(id)]);
      setM(detail);
      setJoin(tok);
      logRtc('ice-config-received', { iceServers: tok.iceServers.length });
      setStatusText('در حال دریافت دسترسی میکروفون/دوربین…');

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      } catch (mediaError) {
        // Safe fallback: keep join path alive with audio-only when camera capture fails.
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setCamOn(false);
        setStatusText('ورود با صدا انجام شد؛ دوربین در دسترس نیست');
        logRtc('media_fallback_audio_only', {
          reason: mediaError instanceof Error ? mediaError.name : 'unknown',
        });
      }
      localStreamRef.current = stream;
      setLocalPreviewStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      stream.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });
      const videoTracks = stream.getVideoTracks();
      videoTracks.forEach((t) => {
        t.enabled = true;
      });
      setMicOn(true);
      if (videoTracks.length > 0) {
        setCamOn(true);
      }
      setMediaReady(true);
      setStatusText('اتصال به اتاق…');
    } catch (e) {
      const err = e instanceof Error ? e : null;
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
      }
      setError(e instanceof Error ? e.message : 'خطا');
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
  }, [closeAllPeerConnections, id, stopAndClearMedia]);

  useEffect(() => {
    void load();
    return () => {
      if (socket && id) socket.emit('meeting_leave', { meetingId: id });
      closeAllPeerConnections();
      stopAndClearMedia();
      setMediaReady(false);
      setParticipants([]);
      setSelfId(null);
      selfIdRef.current = null;
    };
  }, [closeAllPeerConnections, id, load, socket, stopAndClearMedia]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void fetchMeetingChat(id, 50)
      .then((rows) => {
        if (cancelled) return;
        setChatMessages(
          rows.map((row) => ({
            id: row.id,
            senderId: row.sender.id,
            senderName: row.sender.name,
            text: row.text,
            at: new Date(row.createdAt),
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setChatMessages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!socket || !connected || !id || !join?.token || !mediaReady || !localStreamRef.current) return;

    let mounted = true;
    setStatusText('در حال پیوستن به اتاق…');

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
      logRtc('signal-in', { type: payload.type, from: payload.fromUserId, target: payload.targetUserId });
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
          logRtc('signal-out', {
            type: 'answer',
            to: payload.fromUserId,
            sdpLen: answer.sdp?.length ?? 0,
          });
          await emitMeetingSignalWithAck({
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
      // Pairwise offerer: for each remote peer, the user with the lower id
      // (lexicographic) is the offerer. In 2-person calls this degenerates
      // to the previous single-offerer behavior. Perfect-negotiation handles
      // residual glare.
      for (const p of remotes) {
        if (sid.localeCompare(p.id) < 0) {
          window.setTimeout(() => {
            void createOfferTo(p.id);
          }, 120);
        }
      }
    };

    const onMeetingChatMessage = (payload: {
      meetingId: string;
      id: string;
      sender?: { id?: string; name?: string };
      text?: string;
      createdAt?: string;
    }) => {
      if (payload.meetingId !== id) return;
      const text = payload.text?.trim();
      if (!text) return;
      upsertChatMessage({
        id: payload.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        senderId: payload.sender?.id ?? null,
        senderName: payload.sender?.name?.trim() || 'کاربر',
        text,
        at: payload.createdAt ? new Date(payload.createdAt) : new Date(),
      });
    };

    const onMeetingReaction = (payload: { meetingId: string; id?: string; emoji?: string }) => {
      if (payload.meetingId !== id) return;
      const emoji = payload.emoji?.trim();
      if (!emoji) return;
      const rid = payload.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setReactionBursts((prev) => [...prev, { id: rid, emoji }]);
      window.setTimeout(() => {
        setReactionBursts((prev) => prev.filter((x) => x.id !== rid));
      }, 1500);
    };

    socket.on('meeting_participant_joined', onParticipantJoined);
    socket.on('meeting_participant_left', onParticipantLeft);
    socket.on('meeting_signal', onSignal);
    socket.on('meeting_roster', onRoster);
    socket.on('meeting_chat_message', onMeetingChatMessage);
    socket.on('meeting_reaction', onMeetingReaction);
    socket.emit(
      'meeting_join',
      { meetingId: id, joinToken: join.token },
      async (ack: { ok?: boolean; self?: RoomParticipant; participants?: RoomParticipant[] }) => {
        if (!mounted) return;
        if (!ack?.ok || !ack.self) {
          setError('پیوستن به اتاق انجام نشد.');
          setStatusText('خطا در پیوستن');
          return;
        }
        const self = ack.self;
        setSelfId(self.id);
        selfIdRef.current = self.id;
        const list = Array.isArray(ack.participants) ? ack.participants : [self];
        setParticipants(list);
        setStatusText('اتاق آماده است');
        const remotes = list.filter((p) => p.id !== self.id);
        if (remotes.length > 0) {
          setRtcStage('peer_joined');
          const deterministicOfferer = [...list].map((p) => p.id).sort((a, b) => a.localeCompare(b))[0] ?? null;
          setOffererUserId(deterministicOfferer);
          // Pairwise offerer: offer to every remote whose id sorts after ours.
          // In 2-person meetings this is identical to the previous behavior.
          for (const remote of remotes) {
            if (self.id.localeCompare(remote.id) < 0) {
              window.setTimeout(() => {
                void createOfferTo(remote.id);
              }, 120);
            }
          }
        }
      },
    );
    setRtcDebug((d) => ({ ...d, joinEmitted: true }));

    return () => {
      mounted = false;
      socket.emit('meeting_leave', { meetingId: id });
      socket.off('meeting_participant_joined', onParticipantJoined);
      socket.off('meeting_participant_left', onParticipantLeft);
      socket.off('meeting_signal', onSignal);
      socket.off('meeting_roster', onRoster);
      socket.off('meeting_chat_message', onMeetingChatMessage);
      socket.off('meeting_reaction', onMeetingReaction);
    };
  }, [connected, createOfferTo, createPeerConnection, emitMeetingSignalWithAck, id, join?.token, logRtc, mediaReady, socket, upsertChatMessage]);

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
  const selfParticipant = useMemo(() => participants.find((p) => p.id === selfId) ?? null, [participants, selfId]);
  const remotePrimary = remotes[0] ?? null;
  const remoteOthers = remotes.slice(1);
  const remoteMediaSummary = useMemo(
    () =>
      remoteStreams.map((r) => ({
        userId: r.userId,
        audio: r.stream.getAudioTracks().filter((t) => t.readyState === 'live').length,
        video: r.stream.getVideoTracks().filter((t) => t.readyState === 'live').length,
      })),
    [remoteStreams],
  );
  const hasRemoteSessionEvidence = useMemo(
    () =>
      remoteParticipants.some((p) => {
        const hasStream = remoteStreamsRef.current.has(p.id);
        const pc = pcsRef.current.get(p.id);
        const hasReceiverTrack =
          !!pc &&
          pc
            .getReceivers()
            .some((r) => !!r.track && (r.track.kind === 'audio' || r.track.kind === 'video') && r.track.readyState === 'live');
        return hasStream || hasReceiverTrack;
      }),
    [remoteParticipants, remoteStreams, rtcStage],
  );

  useEffect(() => {
    if (permissionDenied) {
      setStatusText('اجازه دوربین/میکروفون داده نشد');
      return;
    }
    if (!join || !localStreamRef.current) return;
    if (remoteStreams.length > 0 || rtcStage === 'connected') {
      setStatusText('متصل به شرکت‌کننده');
      return;
    }
    if (remoteParticipants.length > 0 || rtcStage === 'peer_joined' || rtcStage === 'negotiating' || rtcStage === 'ice_connecting') {
      if (hasRemoteSessionEvidence) {
        setStatusText('اتصال برقرار است؛ در حال آماده‌سازی رسانه…');
        return;
      }
      setStatusText('در حال اتصال به شرکت‌کننده…');
      return;
    }
    if (rtcStage === 'failed') {
      setStatusText('اتصال پایدار نشد');
      return;
    }
    setStatusText('منتظر ورود شرکت‌کننده…');
  }, [hasRemoteSessionEvidence, join, permissionDenied, remoteStreams.length, remoteParticipants.length, rtcStage]);

  function sendChatMessage() {
    const text = chatDraft.trim();
    if (!text || !socket || !id) return;
    socket.emit('meeting_chat_send', { meetingId: id, text });
    setChatDraft('');
  }

  function pushReaction(emoji: string) {
    if (!socket || !id) return;
    socket.emit('meeting_reaction_send', { meetingId: id, emoji });
  }

  function onScreenSharePressed() {
    setScreenShareNotice('اشتراک صفحه در این نسخه به‌زودی اضافه می‌شود.');
    window.setTimeout(() => setScreenShareNotice(null), 2500);
  }

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

        {permissionDenied ? (
          <div className="mx-3 mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-200">
            برای ورود به جلسه اجازه میکروفون و دوربین لازم است.
          </div>
        ) : null}

        <div className="flex flex-1 flex-col gap-3 p-3 pb-28">
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-zinc-900 shadow-inner ring-1 ring-black/20">
            {remotePrimary ? (
              <>
                <RemoteTile
                  stream={remotePrimary.stream}
                  title={remotePrimary.participant?.name ?? 'شرکت‌کننده'}
                  avatarUrl={remotePrimary.participant?.avatar ?? null}
                  logRtc={logRtc}
                />
                <span className="absolute right-2 top-2 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-bold text-white">
                  اتصال برقرار شد
                </span>
              </>
            ) : (
              <>
                <video ref={localVideoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
                <div className="absolute inset-x-0 bottom-2 text-center">
                  <span className="rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white">در انتظار ورود دیگران</span>
                </div>
              </>
            )}

            {remotePrimary ? (
              <div className="absolute bottom-2 left-2 z-20 h-28 w-24 overflow-hidden rounded-xl border border-white/40 bg-black/70 shadow-lg sm:h-32 sm:w-28">
                <SelfPreviewVideo stream={localPreviewStream} className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  شما
                </div>
              </div>
            ) : null}

            {reactionBursts.length > 0 ? (
              <div className="pointer-events-none absolute inset-0">
                {reactionBursts.map((burst, idx) => (
                  <span
                    key={burst.id}
                    className="absolute animate-bounce text-3xl"
                    style={{ left: `${18 + (idx % 5) * 15}%`, bottom: `${16 + (idx % 3) * 10}%` }}
                  >
                    {burst.emoji}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--card-bg)] p-2 ring-1 ring-[var(--border-soft)]">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">سایر شرکت‌کنندگان</p>
            {remoteOthers.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {remoteOthers.map((remote) => (
                  <RemoteTile
                    key={remote.userId}
                    stream={remote.stream}
                    title={remote.participant?.name ?? 'شرکت‌کننده'}
                    avatarUrl={remote.participant?.avatar ?? null}
                    logRtc={logRtc}
                  />
                ))}
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[10px] text-[var(--text-secondary)] ring-1 ring-[var(--border-soft)]">
                {remotePrimary ? 'شرکت‌کننده دیگری در حال حاضر نیست' : 'هنوز شرکت‌کننده‌ای وصل نشده است'}
              </div>
            )}
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
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="flex h-12 min-w-[4.5rem] items-center justify-center rounded-full bg-[var(--surface-soft)] px-3 text-xs font-extrabold text-[var(--text-primary)] shadow-md"
            >
              گفتگوی جلسه
            </button>
            <button
              type="button"
              onClick={onScreenSharePressed}
              className="flex h-12 min-w-[4.5rem] items-center justify-center rounded-full bg-[var(--surface-soft)] px-3 text-xs font-extrabold text-[var(--text-primary)] shadow-md"
            >
              اشتراک صفحه
            </button>
          </div>
          <div className="mt-2 flex items-center justify-center gap-2">
            {SELF_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => pushReaction(emoji)}
                className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-base"
                aria-label={`واکنش ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </footer>

        {chatOpen ? (
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={(e) => {
              if (e.target === e.currentTarget) setChatOpen(false);
            }}
          >
            <div className="absolute bottom-0 right-0 w-full rounded-t-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-3 shadow-2xl sm:bottom-0 sm:left-auto sm:right-0 sm:top-0 sm:w-[24rem] sm:rounded-none sm:border-l">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-extrabold text-[var(--text-primary)]">گفتگوی جلسه</p>
                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  className="rounded-full bg-[var(--surface-soft)] px-2 py-1 text-xs font-bold text-[var(--text-secondary)]"
                >
                  بستن
                </button>
              </div>
              <div className="mb-2 flex gap-1.5">
                {SELF_REACTIONS.map((emoji) => (
                  <button
                    key={`chat-${emoji}`}
                    type="button"
                    onClick={() => setChatDraft((prev) => `${prev}${emoji}`)}
                    className="rounded-full bg-[var(--surface-soft)] px-2 py-1 text-sm"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="h-[40vh] overflow-y-auto rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2 sm:h-[calc(100vh-12rem)]">
                {chatMessages.length === 0 ? (
                  <p className="text-xs text-[var(--text-secondary)]">پیامی ثبت نشده است.</p>
                ) : (
                  <div className="space-y-2">
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`rounded-lg px-2 py-1.5 ${
                          msg.senderId && selfId && msg.senderId === selfId
                            ? 'bg-[var(--accent-soft)]'
                            : 'bg-[var(--card-bg)]'
                        }`}
                      >
                        <p className="text-[11px] font-bold text-[var(--text-primary)]">{msg.senderName}</p>
                        <p className="mt-0.5 text-sm text-[var(--text-primary)]">{msg.text}</p>
                        <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
                          {msg.at.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      sendChatMessage();
                    }
                  }}
                  maxLength={280}
                  placeholder="پیام کوتاه بنویسید…"
                  className="flex-1 rounded-xl border border-[var(--border-soft)] bg-[var(--card-bg)] px-3 py-2 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={sendChatMessage}
                  className="rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-extrabold text-[var(--accent-contrast)]"
                >
                  ارسال
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {screenShareNotice ? (
          <div className="pointer-events-none fixed inset-x-0 top-16 z-50 mx-auto w-fit rounded-full bg-black/80 px-3 py-1.5 text-xs font-bold text-white">
            {screenShareNotice}
          </div>
        ) : null}
      </div>
    </AuthGate>
  );
}

function SelfPreviewVideo({ stream, className }: { stream: MediaStream | null; className?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!stream) {
      el.srcObject = null;
      return;
    }
    el.srcObject = stream;
    const p = el.play();
    if (p !== undefined) {
      void p.catch(() => {
        /* ignored */
      });
    }
    return () => {
      if (ref.current) ref.current.srcObject = null;
    };
  }, [stream]);
  return <video ref={ref} className={className} autoPlay muted playsInline />;
}

function RemoteTile({
  stream,
  title,
  avatarUrl,
  logRtc,
}: {
  stream: MediaStream;
  title: string;
  avatarUrl: string | null;
  logRtc: (event: string, data?: Record<string, unknown>) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [trackVersion, setTrackVersion] = useState(0);
  const [hasLiveVideo, setHasLiveVideo] = useState(false);
  const isSafariWebKit = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    const isAppleWebKit = /AppleWebKit/i.test(ua);
    const isSafari = /Safari/i.test(ua);
    const isOtherEngine = /Chrome|CriOS|Chromium|Edg|EdgiOS|FxiOS|OPiOS|SamsungBrowser|Android/i.test(ua);
    return isAppleWebKit && isSafari && !isOtherEngine;
  }, []);

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
      return;
    }
    const videoTracks = stream.getVideoTracks().filter((t) => t.readyState === 'live');
    const videoOnly = new MediaStream(videoTracks);
    el.srcObject = null;
    el.srcObject = videoOnly;
    void (async () => {
      try {
        await el.play();
      } catch {
        /* see tryPlayVideo / event handlers */
      }
    })();
    let retryTimerA: ReturnType<typeof setTimeout> | null = null;
    let retryTimerB: ReturnType<typeof setTimeout> | null = null;
    if (isSafariWebKit) {
      retryTimerA = setTimeout(() => {
        void tryPlayVideo();
      }, 120);
      retryTimerB = setTimeout(() => {
        void tryPlayVideo();
      }, 450);
    }
    const blackFrameTimer = setTimeout(() => {
      const videoEl = videoRef.current;
      if (!videoEl || !hasLiveVideo) return;
      if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) return;
      logRtc('remote-video-black-frame-retry', { title });
      videoEl.srcObject = videoOnly;
      void tryPlayVideo();
    }, 1400);
    return () => {
      if (retryTimerA) clearTimeout(retryTimerA);
      if (retryTimerB) clearTimeout(retryTimerB);
      clearTimeout(blackFrameTimer);
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [hasLiveVideo, isSafariWebKit, logRtc, stream, title, trackVersion, tryPlayVideo]);

  useEffect(() => {
    if (!isSafariWebKit || !hasLiveVideo) return;
    const retry = () => {
      void tryPlayVideo();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') retry();
    };
    window.addEventListener('focus', retry);
    window.addEventListener('pageshow', retry);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', retry);
      window.removeEventListener('pageshow', retry);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [hasLiveVideo, isSafariWebKit, tryPlayVideo]);

  useEffect(() => {
    if (!isSafariWebKit || !hasLiveVideo) return;
    const el = videoRef.current;
    if (!el) return;
    const stepsMs = [150, 400, 900, 1600, 2600];
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const shouldRetry = () => {
      const e = videoRef.current;
      if (!e) return false;
      if (e.paused) return true;
      if (e.readyState < 2) return true;
      return e.currentTime === 0 && e.videoWidth === 0;
    };
    for (const delay of stepsMs) {
      timers.push(
        setTimeout(() => {
          if (shouldRetry()) {
            void tryPlayVideo();
          }
        }, delay),
      );
    }
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [hasLiveVideo, isSafariWebKit, trackVersion, tryPlayVideo]);

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

  return (
    <div className="relative overflow-hidden rounded-xl bg-black ring-1 ring-[var(--border-soft)]">
      {hasLiveVideo ? (
        <video
          ref={videoRef}
          className="aspect-video w-full object-cover"
          autoPlay
          playsInline
          muted={false}
          controls={false}
          onLoadedMetadata={() => {
            void tryPlayVideo();
          }}
          onCanPlay={() => {
            void tryPlayVideo();
          }}
        />
      ) : (
        <div className="relative flex aspect-video w-full flex-col items-center justify-center gap-2 bg-[var(--surface-soft)] text-[10px] text-[var(--text-secondary)]">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-[var(--border-soft)]" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-600 text-lg font-bold text-white ring-2 ring-[var(--border-soft)]">
              {initial}
            </div>
          )}
          <span className="font-bold text-[var(--text-primary)]">Audio only</span>
        </div>
      )}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      <div className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">
        {title}
      </div>
    </div>
  );
}
