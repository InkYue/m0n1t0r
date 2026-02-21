import { useCallback, useEffect, useRef, useState } from "react";

export interface UseWebSocketOptions {
  url: string;
  onMessage?: (event: MessageEvent) => void;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  autoConnect?: boolean;
  binaryType?: BinaryType;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const { url, onMessage, onOpen, onClose, onError, autoConnect = true, binaryType } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = url.startsWith("ws") ? url : `${protocol}//${host}${url}`;

    const ws = new WebSocket(wsUrl);
    if (binaryType) ws.binaryType = binaryType;

    ws.onopen = (e) => {
      setConnected(true);
      onOpen?.(e);
    };
    ws.onmessage = (e) => onMessage?.(e);
    ws.onclose = (e) => {
      setConnected(false);
      onClose?.(e);
    };
    ws.onerror = (e) => onError?.(e);

    wsRef.current = ws;
  }, [url, onMessage, onOpen, onClose, onError, binaryType]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  const send = useCallback((data: string | ArrayBuffer | Blob) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  useEffect(() => {
    if (autoConnect) connect();
    return () => disconnect();
  }, [autoConnect, connect, disconnect]);

  return { connected, connect, disconnect, send, ws: wsRef };
}
