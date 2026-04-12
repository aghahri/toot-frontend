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
import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/api';

type RealtimeCtx = {
  socket: Socket | null;
  connected: boolean;
};

const RealtimeContext = createContext<RealtimeCtx>({ socket: null, connected: false });

export function AppRealtimeProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback(() => {
    const token = getAccessToken();
    if (!token) {
      socketRef.current?.removeAllListeners();
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
      return;
    }

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const s = io(getApiBaseUrl().replace(/\/+$/, ''), {
      transports: ['websocket'],
      auth: { token },
    });
    socketRef.current = s;
    setSocket(s);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    if (s.connected) setConnected(true);
  }, []);

  useEffect(() => {
    connect();
    const onAuth = () => connect();
    window.addEventListener('toot-auth-token-changed', onAuth);
    return () => {
      window.removeEventListener('toot-auth-token-changed', onAuth);
      socketRef.current?.removeAllListeners();
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [connect]);

  const value = useMemo(() => ({ socket, connected }), [socket, connected]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useAppRealtime() {
  return useContext(RealtimeContext);
}
