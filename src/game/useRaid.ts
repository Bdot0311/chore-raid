import { useCallback, useEffect, useRef, useState } from 'react';
import { raidReducer, type RaidAction, type RaidEvent } from './raidReducer';
import { saveRaid } from './store';
import type { Raid } from './types';

const PERSIST_DEBOUNCE_MS = 250;
const TICK_MS = 500;

/**
 * Runs the pure reducer, persists after every change (debounced) and hands
 * reducer events to `onEvents` for side effects: sound, speech, screen flow.
 */
export function useRaid(initial: Raid, onEvents: (events: RaidEvent[], raid: Raid) => void) {
  const [raid, setRaid] = useState(initial);
  const raidRef = useRef(initial);
  const onEventsRef = useRef(onEvents);
  onEventsRef.current = onEvents;
  const persistTimer = useRef<number | undefined>(undefined);

  const flush = useCallback(() => {
    window.clearTimeout(persistTimer.current);
    persistTimer.current = undefined;
    return saveRaid(raidRef.current);
  }, []);

  const dispatch = useCallback(
    (action: RaidAction) => {
      const { raid: next, events } = raidReducer(raidRef.current, action, Date.now());
      if (next !== raidRef.current) {
        raidRef.current = next;
        setRaid(next);
        if (next.status !== 'active') {
          void flush();
        } else {
          window.clearTimeout(persistTimer.current);
          persistTimer.current = window.setTimeout(() => void flush(), PERSIST_DEBOUNCE_MS);
        }
      }
      if (events.length) onEventsRef.current(events, next);
    },
    [flush],
  );

  useEffect(() => {
    const id = window.setInterval(() => dispatch({ type: 'TICK' }), TICK_MS);
    return () => window.clearInterval(id);
  }, [dispatch]);

  // A locked phone or a swipe-away must not lose the last hits.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    const onPageHide = () => void flush();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      if (persistTimer.current !== undefined) void flush();
    };
  }, [flush]);

  return { raid, dispatch, flush };
}
