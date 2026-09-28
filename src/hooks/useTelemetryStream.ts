import { useState, useEffect, useCallback, useRef } from 'react';
import type { TelemetryMessage, TelemetryEventType } from '../types/weather';

const API_BASE_URL = 'http://127.0.0.1:8000/v1';

/** Hook that connects to the real SSE endpoint /v1/events/stream */
export function useTelemetryStream(options?: {
  enabled?: boolean;
  onMessage?: (msg: TelemetryMessage) => void;
}) {
  const { enabled = true, onMessage } = options ?? {};
  const [lastMessage, setLastMessage] = useState<TelemetryMessage | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const callbackRef = useRef(onMessage);
  callbackRef.current = onMessage;
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) return;

    const token = localStorage.getItem('admin_token');
    if (!token) {
      console.warn('[SkySignal SSE] No admin token — cannot connect to telemetry stream.');
      return;
    }

    // EventSource doesn't support custom headers, so pass token as query param
    const url = `${API_BASE_URL}/events/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
    };

    const processMessage = (type: TelemetryEventType, payload: any) => {
      const msg: TelemetryMessage = {
        type,
        payload,
        timestamp: new Date().toISOString(),
      };
      setLastMessage(msg);
      setMessageCount((c) => c + 1);
      callbackRef.current?.(msg);

      // Dispatch global window event so Dashboard UI updates instantly
      const customEvent = new CustomEvent('skysignal:telemetry', { detail: msg });
      window.dispatchEvent(customEvent);
    };

    // Listen for typed SSE events
    const handleEvent = (type: TelemetryEventType) => (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        processMessage(type, payload);
      } catch (err) {
        console.warn('[SkySignal SSE] Failed to parse message:', err);
      }
    };

    es.addEventListener('event_created', handleEvent('event_created'));
    es.addEventListener('event_updated', handleEvent('event_updated'));

    // Also handle generic 'message' events (fallback)
    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        processMessage('event_updated', payload);
      } catch {
        // Ignore unparseable heartbeat messages
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      // EventSource auto-reconnects; no manual retry needed
    };
  }, []);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      disconnect();
      return;
    }

    connect();

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    lastMessage,
    messageCount,
    isConnected,
    connect,
    disconnect,
  };
}
