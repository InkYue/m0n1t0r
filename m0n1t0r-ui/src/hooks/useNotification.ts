import { useCallback, useEffect, useRef } from "react";
import type { ConnectEvent } from "../api/types";

export function useServerNotification(
  onEvent: (event: ConnectEvent) => void
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const ws = new WebSocket(
      `${protocol}//${host}/api/v1/server/notification`
    );

    ws.onmessage = (e) => {
      try {
        const event: ConnectEvent = JSON.parse(e.data);
        onEventRef.current(event);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setTimeout(connect, 3000);
    };

    return ws;
  }, []);

  useEffect(() => {
    const ws = connect();
    return () => ws.close();
  }, [connect]);
}
