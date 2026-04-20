'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { useAppRealtime } from '@/context/AppRealtimeSocketContext';
import { fetchJoinToken, fetchMeeting, type JoinTokenResponse, type MeetingDetail } from '@/lib/meetings';

type RoomParticipant = {
  id: string;
  name: string;
  avatar: string | null;
  username: string;
};

type RtcStage = 'waiting' | 'peer_joined' | 'negotiating' | 'ice_connecting' | 'connected' | 'failed';

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
  const [rtcStage, setRtcStage] = useState<RtcStage>('waiting');

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const hasPendingOfferRef = useRef<Map<string, boolean>>(new Map());
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
    hasPendingOfferRef.current.clear();
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

      pc.ontrack = (e) => {
        logRtc('ontrack', {
          from: remoteUserId,
          kind: e.track.kind,
          trackState: e.track.readyState,
          streamTracks: e.streams[0]?.getTracks().map((t) => `${t.kind}:${t.readyState}`) ?? [],
        });
        const existing = remoteStreamsRef.current.get(remoteUserId);
        if (existing) {
          if (!existing.getTracks().some((t) => t.id === e.track.id)) {
            existing.addTrack(e.track);
          }
          remoteStreamsRef.current.set(remoteUserId, existing);
        } else {
          const stream = e.streams[0] ?? new MediaStream([e.track]);
          remoteStreamsRef.current.set(remoteUserId, stream);
        }
        setRtcStage('connected');
        setRemoteStreams(Array.from(remoteStreamsRef.current.entries()).map(([userId, s]) => ({ userId, stream: s })));
      };

      const handleDisconnect = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
          pc.close();
          pcsRef.current.delete(remoteUserId);
          pendingIceRef.current.delete(remoteUserId);
          makingOfferRef.current.delete(remoteUserId);
          hasPendingOfferRef.current.delete(remoteUserId);
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
    [id, join?.iceServers, logRtc, socket],
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

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    setPermissionDenied(false);
    try {
      const [detail, tok] = await Promise.all([fetchMeeting(id), fetchJoinToken(id)]);
      setM(detail);
      setJoin(tok);
      setStatusText('در حال دریافت دسترسی میکروفون/دوربین…');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      stream.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });
      stream.getVideoTracks().forEach((t) => {
        t.enabled = true;
      });
      setMicOn(true);
      setCamOn(true);
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
    if (!socket || !connected || !id || !join?.token || !mediaReady || !localStreamRef.current) return;

    let mounted = true;
    setStatusText('در حال پیوستن به اتاق…');

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
        if (list.some((p) => p.id !== self.id)) {
          setRtcStage('peer_joined');
        }
        for (const p of list) {
          if (p.id === self.id) continue;
          if (self.id < p.id) {
            await createOfferTo(p.id);
          }
        }
      },
    );

    const onParticipantJoined = async (payload: { meetingId: string; participant: RoomParticipant }) => {
      if (payload.meetingId !== id) return;
      if (payload.participant.id === selfIdRef.current) return;
      setParticipants((prev) => {
        if (prev.some((x) => x.id === payload.participant.id)) return prev;
        return [...prev, payload.participant];
      });
      setRtcStage((prev) => (prev === 'connected' ? prev : 'peer_joined'));
      const sid = selfIdRef.current ?? '';
      if (sid && sid < payload.participant.id) {
        await createOfferTo(payload.participant.id);
      }
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
          const pending = pendingIceRef.current.get(payload.fromUserId) ?? [];
          for (const c of pending) {
            await pc.addIceCandidate(c);
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
          const pending = pendingIceRef.current.get(payload.fromUserId) ?? [];
          for (const c of pending) {
            await pc.addIceCandidate(c);
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
            return;
          }
          await pc.addIceCandidate(payload.candidate);
          logRtc('apply_ice', { from: payload.fromUserId });
        }
      } catch {
        setError('سیگنال WebRTC نامعتبر بود.');
        setRtcStage('failed');
      } finally {
        isSettingRemoteAnswerRef.current.set(payload.fromUserId, false);
      }
    };

    socket.on('meeting_participant_joined', onParticipantJoined);
    socket.on('meeting_participant_left', onParticipantLeft);
    socket.on('meeting_signal', onSignal);

    return () => {
      mounted = false;
      socket.emit('meeting_leave', { meetingId: id });
      socket.off('meeting_participant_joined', onParticipantJoined);
      socket.off('meeting_participant_left', onParticipantLeft);
      socket.off('meeting_signal', onSignal);
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
      setStatusText('در حال اتصال به شرکت‌کننده…');
      return;
    }
    if (rtcStage === 'failed') {
      setStatusText('اتصال پایدار نشد');
      return;
    }
    setStatusText('منتظر ورود شرکت‌کننده…');
  }, [join, permissionDenied, remoteStreams.length, remoteParticipants.length, rtcStage]);

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
          <div className="aspect-video w-full overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-zinc-900 shadow-inner ring-1 ring-black/20">
            <video ref={localVideoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
          </div>

          <div className="min-h-[120px] flex-1 rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--card-bg)] p-2 ring-1 ring-[var(--border-soft)]">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">سایر شرکت‌کنندگان</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {remoteParticipants.length > 0
                ? remoteParticipants.map((p) => {
                    const remote = remotes.find((r) => r.userId === p.id);
                    if (remote) {
                      return <RemoteTile key={p.id} stream={remote.stream} title={p.name} />;
                    }
                    return (
                      <div
                        key={p.id}
                        className="flex aspect-video items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[10px] text-[var(--text-secondary)] ring-1 ring-[var(--border-soft)]"
                      >
                        {`در حال اتصال به ${p.name}…`}
                      </div>
                    );
                  })
                : (
                  <div className="col-span-2 flex aspect-video items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[10px] text-[var(--text-secondary)] ring-1 ring-[var(--border-soft)] sm:col-span-3">
                    هنوز شرکت‌کننده‌ای وصل نشده است
                  </div>
                )}
            </div>
          </div>
        </div>

        {join && process.env.NODE_ENV === 'development' ? (
          <p className="px-3 pb-1 text-[9px] font-mono text-[var(--text-secondary)] opacity-70">
            dev: iceServers={join.iceServers.length} token len={join.token.length}
          </p>
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

function RemoteTile({ stream, title }: { stream: MediaStream; title: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [trackVersion, setTrackVersion] = useState(0);
  const [hasLiveVideo, setHasLiveVideo] = useState(false);
  const [videoMutedState, setVideoMutedState] = useState(false);

  const inspectVideo = useCallback(() => {
    const tracks = stream.getVideoTracks();
    const live = tracks.find((t) => t.readyState === 'live');
    setHasLiveVideo(!!live);
    setVideoMutedState(!!live && (!live.enabled || live.muted));
  }, [stream]);

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
    const onChange = () => inspectVideo();
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
  }, [inspectVideo, stream, trackVersion]);

  useEffect(() => {
    if (!videoRef.current) return;
    const videoTracks = stream.getVideoTracks().filter((t) => t.readyState === 'live');
    const videoOnly = new MediaStream(videoTracks);
    videoRef.current.srcObject = videoOnly;
    const p = videoRef.current.play();
    if (p !== undefined) {
      void p.catch(() => {
        /* browser may delay autoplay; keeping srcObject allows retry when tab is active */
      });
    }
    return () => {
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [stream, trackVersion]);

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

  return (
    <div className="relative overflow-hidden rounded-xl bg-black ring-1 ring-[var(--border-soft)]">
      {hasLiveVideo ? (
        <video ref={videoRef} className="aspect-video w-full object-cover" autoPlay playsInline muted />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-[var(--surface-soft)] text-[10px] text-[var(--text-secondary)]">
          دوربین خاموش است
        </div>
      )}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      {hasLiveVideo && videoMutedState ? (
        <div className="pointer-events-none absolute left-1 top-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">
          دوربین خاموش
        </div>
      ) : null}
      <div className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">
        {title}
      </div>
    </div>
  );
}
