import { useEffect, useRef, useState } from 'react';
import { toDateMs } from '../../lib/date';
import type { DashboardDataRange } from '../../types/dashboard';

interface UseRangeNoticeOptions {
  dataRange?: DashboardDataRange;
  selectedRange: { from: string; to: string };
}

export function useRangeNotice({ dataRange, selectedRange }: UseRangeNoticeOptions) {
  const [message, setMessage] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!dataRange?.start && !dataRange?.end) {
      setMessage(null);
      setIsVisible(false);
      return;
    }

    const messages: string[] = [];
    if (dataRange.start && toDateMs(selectedRange.from) < toDateMs(dataRange.start)) {
      messages.push(`Data starts on ${dataRange.start}.`);
    }
    if (dataRange.end && toDateMs(selectedRange.to) > toDateMs(dataRange.end)) {
      messages.push(`Data ends on ${dataRange.end}.`);
    }

    if (messages.length === 0) {
      setMessage(null);
      setIsVisible(false);
      return;
    }

    setMessage(`${messages.join(' ')} Selected range includes empty days.`);
  }, [dataRange?.start, dataRange?.end, selectedRange.from, selectedRange.to]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const showDelayMs = 220;
    const visibleDurationMs = 5200;
    const exitDurationMs = 700;

    setIsVisible(false);
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
    }

    showTimerRef.current = setTimeout(() => {
      setIsVisible(true);
    }, showDelayMs);

    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, showDelayMs + visibleDurationMs);

    clearTimerRef.current = setTimeout(() => {
      setMessage(null);
    }, showDelayMs + visibleDurationMs + exitDurationMs);

    return () => {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    };
  }, [message]);

  return { message, isVisible };
}
