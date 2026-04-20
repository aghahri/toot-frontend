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
  const [remoteStreams, setRemoteStreams] = useState<Array<{ userId: string; stream: MediaStream }>>([]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());

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
        socket.emit('meeting_signal', {
          meetingId: id,
          targetUserId: remoteUserId,
          type: 'ice-candidate',
          candidate: e.candidate.toJSON(),
        });
      };

      pc.ontrack = (e) => {
        const stream = e.streams[0] ?? new MediaStream([e.track]);
        remoteStreamsRef.current.set(remoteUserId, stream);
        setRemoteStreams(Array.from(remoteStreamsRef.current.entries()).map(([userId, s]) => ({ userId, stream: s })));
      };

      const handleDisconnect = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
          pc.close();
          pcsRef.current.delete(remoteUserId);
          remoteStreamsRef.current.delete(remoteUserId);
          setRemoteStreams(Array.from(remoteStreamsRef.current.entries()).map(([userId, s]) => ({ userId, stream: s })));
        }
      };
      pc.onconnectionstatechange = handleDisconnect;
      pc.oniceconnectionstatechange = handleDisconnect;

      return pc;
    },
    [id, join?.iceServers, socket],
  );

  const createOfferTo = useCallback(
    async (remoteUserId: string) => {
      try {
        const pc = createPeerConnection(remoteUserId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (!socket || !id) return;
        socket.emit('meeting_signal', {
          meetingId: id,
          targetUserId: remoteUserId,
          type: 'offer',
          sdp: offer.sdp,
        });
      } catch {
        setError('ایجاد اتصال به شرکت‌کننده انجام نشد.');
      }
    },
    [createPeerConnection, id, socket],
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
      setStatusText('اتصال به اتاق…');
    } catch (e) {
      const err = e instanceof Error ? e : null;
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
      }
      setError(e instanceof Error ? e.message : 'خطا');
      setM(null);
      setJoin(null);
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
    };
  }, [closeAllPeerConnections, id, load, socket, stopAndClearMedia]);

  useEffect(() => {
    if (!socket || !connected || !id || !join?.token || !localStreamRef.current) return;

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
        setSelfId(ack.self.id);
        const list = Array.isArray(ack.participants) ? ack.participants : [ack.self];
        setParticipants(list);
        setStatusText('اتاق آماده است');
        for (const p of list) {
          if (p.id === ack.self.id) continue;
          if (ack.self.id < p.id) {
            await createOfferTo(p.id);
          }
        }
      },
    );

    const onParticipantJoined = async (payload: { meetingId: string; participant: RoomParticipant }) => {
      if (payload.meetingId !== id) return;
      setParticipants((prev) => {
        if (prev.some((x) => x.id === payload.participant.id)) return prev;
        return [...prev, payload.participant];
      });
      const sid = selfId ?? '';
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
      if (selfId && payload.targetUserId && payload.targetUserId !== selfId) return;
      if (!selfId || payload.fromUserId === selfId) return;
      const pc = createPeerConnection(payload.fromUserId);
      try {
        if (payload.type === 'offer' && payload.sdp) {
          await pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('meeting_signal', {
            meetingId: id,
            targetUserId: payload.fromUserId,
            type: 'answer',
            sdp: answer.sdp,
          });
          return;
        }
        if (payload.type === 'answer' && payload.sdp) {
          await pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
          return;
        }
        if (payload.type === 'ice-candidate' && payload.candidate) {
          await pc.addIceCandidate(payload.candidate);
        }
      } catch {
        setError('سیگنال WebRTC نامعتبر بود.');
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
  }, [connected, createOfferTo, createPeerConnection, id, join?.token, selfId, socket]);

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
    router.push(id ? `/meetings/${id}` : '/spaces/education');
  }

  useEffect(() => {
    if (permissionDenied) {
      setStatusText('اجازه دوربین/میکروفون داده نشد');
    } else if (remoteStreams.length > 0) {
      setStatusText('متصل');
    } else if (join && localStreamRef.current) {
      setStatusText('منتظر ورود شرکت‌کننده…');
    }
  }, [join, permissionDenied, remoteStreams.length]);

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
              {remotes.length > 0 ? (
                remotes.map((r) => (
                  <RemoteTile key={r.userId} stream={r.stream} title={r.participant?.name ?? r.userId} />
                ))
              ) : (
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
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative overflow-hidden rounded-xl bg-black ring-1 ring-[var(--border-soft)]">
      <video ref={ref} className="aspect-video w-full object-cover" autoPlay playsInline />
      <div className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">
        {title}
      </div>
    </div>
  );
}
