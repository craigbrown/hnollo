import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { pageScrollTop } from "../pageScroll";

const REFRESH_THRESHOLD = 120;
const MAX_PULL = 200;
const RESTING_HEIGHT = 48;

interface PullGesture {
  x: number;
  y: number;
  started: boolean;
  triggered: boolean;
  finished: boolean;
}

export function PullToRefresh({
  contentRef,
  routeKey,
  disabled,
  refreshing,
  onRefresh,
}: {
  contentRef: RefObject<HTMLElement | null>;
  routeKey: string;
  disabled: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [distance, setDistance] = useState(0);
  const [settling, setSettling] = useState(false);
  const gesture = useRef<PullGesture | null>(null);
  const pending = useRef(false);
  const refreshingRef = useRef(refreshing);
  refreshingRef.current = refreshing;
  useEffect(() => {
    const scroll = contentRef.current;
    if (!scroll || disabled) return;
    let disposed = false;
    let suppressClick = false;
    function reset(animate = false) {
      gesture.current = null;
      setSettling(animate);
      setDistance(0);
      scroll!.classList.remove("refresh-gesture");
    }
    function beginRefresh(current: PullGesture) {
      current.triggered = true;
      pending.current = true;
      function complete() {
        pending.current = false;
        if (disposed) return;
        // Ignore further movement from this finger until it lifts, so a held
        // pull cannot open the gap again or start another refresh.
        current.finished = true;
        setSettling(true);
        setDistance(0);
      }
      void onRefresh().then(complete, complete);
    }
    function start(event: TouchEvent) {
      reset();
      suppressClick = false;
      if (
        event.touches.length !== 1 ||
        pageScrollTop() > 1 ||
        refreshingRef.current || pending.current
      ) {
        return;
      }
      const touch = event.touches[0];
      // Preserve edge navigation and text editing, while allowing a drag to
      // start on a post link or button without activating it on release.
      if (
        touch.clientX - scroll!.getBoundingClientRect().left < 26 ||
        (event.target as Element).closest(
          "input,select,textarea,[contenteditable]:not([contenteditable=false]),[role=scrollbar]",
        )
      )
        return;
      gesture.current = {
        x: touch.clientX, y: touch.clientY,
        started: false, triggered: false, finished: false,
      };
      scroll!.classList.add("refresh-gesture");
    }
    function move(event: TouchEvent) {
      const initial = gesture.current;
      if (!initial) return;
      if (event.touches.length !== 1) {
        reset(true);
        return;
      }
      if (initial.finished) {
        if (event.cancelable) event.preventDefault();
        return;
      }
      const dx = event.touches[0].clientX - initial.x;
      const dy = event.touches[0].clientY - initial.y;
      if (
        !initial.started &&
        ((Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) ||
          dy < 0 ||
          pageScrollTop() > 1)
      ) {
        reset(true);
        return;
      }
      if (dy <= 0 && !initial.started) return;
      // Cancel the first downward move before Safari starts native bouncing.
      if (event.cancelable) event.preventDefault();
      if (dy <= 6 && !initial.started) return;
      initial.started = true;
      suppressClick = true;
      const nextDistance = Math.min(MAX_PULL, Math.max(0, dy * 0.45));
      setDistance(nextDistance);
      if (nextDistance >= REFRESH_THRESHOLD && !initial.triggered &&
          !pending.current && !refreshingRef.current)
        beginRefresh(initial);
    }
    function end(event: TouchEvent) {
      if (gesture.current?.started && event.cancelable) event.preventDefault();
      reset(true);
    }
    function click(event: MouseEvent) {
      if (!suppressClick || event.detail === 0 || !scroll!.contains(event.target as Node))
        return;
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    reset();
    scroll.addEventListener("touchstart", start, { passive: true });
    scroll.addEventListener("touchmove", move, { passive: false });
    scroll.addEventListener("touchend", end, { passive: false });
    scroll.addEventListener("touchcancel", end);
    document.addEventListener("click", click, true);
    return () => {
      disposed = true;
      reset();
      scroll.removeEventListener("touchstart", start);
      scroll.removeEventListener("touchmove", move);
      scroll.removeEventListener("touchend", end);
      scroll.removeEventListener("touchcancel", end);
      document.removeEventListener("click", click, true);
    };
  }, [contentRef, routeKey, disabled, onRefresh]);
  if (disabled) return null;
  return (
    <div
      className={`pull-to-refresh ${refreshing ? "pull-loading" : ""} ${settling ? "pull-settling" : ""}`}
      style={{ height: refreshing ? Math.max(RESTING_HEIGHT, distance) : distance }}
      role="status"
      aria-live="polite"
    >
      <svg
        className="pull-spinner"
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{ opacity: refreshing ? 1 : Math.min(1, distance / REFRESH_THRESHOLD) }}
      >
        {Array.from({ length: 12 }, (_, index) => (
          <rect
            key={index}
            x="11" y="1" width="2" height="6" rx="1"
            fill="currentColor"
            opacity={0.2 + index / 11 * 0.8}
            transform={`rotate(${index * 30} 12 12)`}
          />
        ))}
      </svg>
      <span className="sr-only">
        {refreshing
          ? "Refreshing…"
          : distance > 6 ? "Pull to refresh" : ""}
      </span>
    </div>
  );
}
