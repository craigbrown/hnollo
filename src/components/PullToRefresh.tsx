import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { RefreshCw } from "lucide-react";

export function PullToRefresh({
  scrollRef,
  routeKey,
  disabled,
  refreshing,
  onRefresh,
}: {
  scrollRef: RefObject<HTMLElement | null>;
  routeKey: string;
  disabled: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [distance, setDistance] = useState(0);
  const gesture = useRef<{ x: number; y: number; started: boolean } | null>(
    null,
  );
  const distanceRef = useRef(0);
  const refreshingRef = useRef(refreshing);
  refreshingRef.current = refreshing;
  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll || disabled) return;
    function reset() {
      gesture.current = null;
      distanceRef.current = 0;
      setDistance(0);
    }
    function start(event: TouchEvent) {
      if (
        event.touches.length !== 1 ||
        scroll!.scrollTop > 0 ||
        refreshingRef.current
      ) {
        reset();
        return;
      }
      const touch = event.touches[0];
      // Leave the horizontal edge gesture and interactive controls alone.
      if (
        touch.clientX - scroll!.getBoundingClientRect().left < 26 ||
        (event.target as Element).closest(
          "button,input,select,textarea,[role=scrollbar]",
        )
      )
        return;
      gesture.current = { x: touch.clientX, y: touch.clientY, started: false };
    }
    function move(event: TouchEvent) {
      const initial = gesture.current;
      if (!initial || event.touches.length !== 1) return;
      const dx = event.touches[0].clientX - initial.x;
      const dy = event.touches[0].clientY - initial.y;
      if (
        !initial.started &&
        ((Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) ||
          dy < 0 ||
          scroll!.scrollTop > 0)
      ) {
        reset();
        return;
      }
      if (dy <= 6 && !initial.started) return;
      initial.started = true;
      if (event.cancelable) event.preventDefault();
      distanceRef.current = Math.min(100, Math.max(0, dy * 0.45));
      setDistance(distanceRef.current);
    }
    function end(event: TouchEvent) {
      if (gesture.current?.started && event.cancelable) event.preventDefault();
      const shouldRefresh = distanceRef.current >= 64;
      reset();
      if (shouldRefresh && !refreshingRef.current) void onRefresh();
    }
    scroll.addEventListener("touchstart", start, { passive: true });
    scroll.addEventListener("touchmove", move, { passive: false });
    scroll.addEventListener("touchend", end, { passive: false });
    scroll.addEventListener("touchcancel", reset);
    return () => {
      scroll.removeEventListener("touchstart", start);
      scroll.removeEventListener("touchmove", move);
      scroll.removeEventListener("touchend", end);
      scroll.removeEventListener("touchcancel", reset);
    };
  }, [scrollRef, routeKey, disabled, onRefresh]);
  if (disabled) return null;
  return (
    <div
      className={`pull-to-refresh ${distance >= 64 ? "pull-ready" : ""} ${refreshing ? "pull-loading" : ""}`}
      style={{ height: refreshing ? 48 : distance }}
      role="status"
      aria-live="polite"
    >
      <RefreshCw
        size={20}
        aria-hidden="true"
        style={
          refreshing
            ? undefined
            : { transform: `rotate(${Math.min(180, distance * 2.8)}deg)` }
        }
      />
      <span className="sr-only">
        {refreshing
          ? "Refreshing…"
          : distance >= 64
            ? "Release to refresh"
            : distance > 6
              ? "Pull to refresh"
              : ""}
      </span>
    </div>
  );
}
