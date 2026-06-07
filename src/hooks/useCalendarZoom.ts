import { useEffect, useRef, useState, useCallback } from "react";

const STORAGE_KEY = "lilito.calendar.slotHeight";
const MIN_HEIGHT = 22;
const MAX_HEIGHT = 120;

/**
 * Pinch-to-zoom hook for the calendar grid (mobile).
 * - Persists the chosen slot height in localStorage.
 * - Attach the returned ref to the scroll container.
 * - Returns the current `slotHeight` to drive grid layout.
 */
export function useCalendarZoom(defaultHeight: number) {
  const [slotHeight, setSlotHeight] = useState<number>(() => {
    if (typeof window === "undefined") return defaultHeight;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= MIN_HEIGHT && n <= MAX_HEIGHT ? n : defaultHeight;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, String(Math.round(slotHeight)));
  }, [slotHeight]);

  const startDistRef = useRef<number | null>(null);
  const startHeightRef = useRef<number>(slotHeight);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      startDistRef.current = Math.hypot(dx, dy);
      startHeightRef.current = slotHeight;
      // Disable browser's native touch handling so the pinch reaches us.
      if (containerRef.current) containerRef.current.style.touchAction = "none";
    }
  }, [slotHeight]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && startDistRef.current != null) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scale = dist / startDistRef.current;
      const next = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeightRef.current * scale));
      setSlotHeight(next);
    }
  }, []);

  const onTouchEnd = useCallback((e: TouchEvent) => {
    if (e.touches.length < 2) {
      startDistRef.current = null;
      // Restore native pan so single-finger scroll keeps working.
      if (containerRef.current) containerRef.current.style.touchAction = "pan-x pan-y";
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  return { slotHeight, setSlotHeight, containerRef };
}
