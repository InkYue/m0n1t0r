import { useCallback, useEffect, useRef } from "react";
import type { ConnectEvent } from "../api/types";
import { getWsBaseUrl } from "../utils/settings";

export function useServerNotification(
  onEvent: (event: ConnectEvent) => void
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    const ws = new WebSocket(getWsBaseUrl("server/notification"));

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
