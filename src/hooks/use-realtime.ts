"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

export type RealtimeEventMessage = {
  id: number;
  channel: string;
  subjectType: string;
  subjectId: string;
  action: string;
  payload: Record<string, unknown>;
  municipalityId: string | null;
  createdAt: string;
};

/**
 * Keeps the cache in step with the server, without polling.
 *
 * `EventSource` handles reconnection itself, and because every message carries
 * an id it sends `Last-Event-ID` when it comes back — so a tunnel, a lift or a
 * hillside costs a pause rather than a stale screen. Nothing here has to track
 * that; the gap arrives as ordinary messages once the connection returns.
 *
 * The default is to invalidate the queries a channel feeds, which is the right
 * trade for lists that are cheap to refetch. Pass `onEvent` where the payload
 * is enough to patch the cache directly — the live traffic layer does that, so
 * a marker appears without a round trip.
 */
export function useRealtime(options: {
  channels: string[];
  onEvent?: (event: RealtimeEventMessage) => void;
  enabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const onEventRef = useRef(options.onEvent);
  onEventRef.current = options.onEvent;

  const channelKey = options.channels.join(",");
  const enabled = options.enabled ?? true;

  useEffect(() => {
    if (!enabled || channelKey.length === 0) return;

    const source = new EventSource(
      `/api/realtime?channels=${encodeURIComponent(channelKey)}`,
    );

    const handle = (message: MessageEvent<string>) => {
      let event: RealtimeEventMessage;
      try {
        event = JSON.parse(message.data);
      } catch {
        return;
      }

      onEventRef.current?.(event);
      // Scoped to the channel's own key prefix, so a traffic report does not
      // invalidate the consultations list.
      queryClient.invalidateQueries({ queryKey: [event.channel] });
    };

    // The server names each message after the action, so a listener can be
    // narrower later; for now every action is handled the same way.
    for (const action of ["created", "updated", "deleted", "message"]) {
      source.addEventListener(action, handle as EventListener);
    }

    source.onerror = () => {
      // EventSource retries on its own using the server's `retry:` hint. Logging
      // it as an error would cry wolf every time someone walks into a dead spot.
      if (source.readyState === EventSource.CLOSED) {
        console.info("realtime stream closed by the server");
      }
    };

    return () => source.close();
  }, [channelKey, enabled, queryClient]);
}
