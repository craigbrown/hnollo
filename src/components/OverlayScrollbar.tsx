import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

interface Metrics {
  range: number;
  track: number;
  thumb: number;
  top: number;
  percent: number;
}
const empty: Metrics = { range: 0, track: 0, thumb: 0, top: 0, percent: 0 };

// Native overlay scrollbars are controlled by the browser/OS. This indicator
// consistently overlays the native scroll surface without shrinking its width.
export function OverlayScrollbar({
  scrollRef,
  routeKey,
}: {
  scrollRef: RefObject<HTMLElement | null>;
  routeKey: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef(empty);
  const drag = useRef<{ offset: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [metrics, setMetrics] = useState(empty);
  const [active, setActive] = useState(false);

  function reveal() {
    setActive(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!drag.current) setActive(false);
    }, 1000);
  }

  useEffect(() => {
    const scroll = scrollRef.current;
    const track = trackRef.current;
    if (!scroll || !track) return;
    setActive(false);
    let frame = 0;
    function measure() {
      const range = Math.max(0, scroll!.scrollHeight - scroll!.clientHeight);
      const height = track!.clientHeight;
      const thumb = Math.min(
        height,
        Math.max(
          30,
          (height * scroll!.clientHeight) / Math.max(scroll!.scrollHeight, 1),
        ),
      );
      const ratio = range
        ? Math.min(1, Math.max(0, scroll!.scrollTop / range))
        : 0;
      const next = {
        range,
        track: height,
        thumb,
        top: ratio * (height - thumb),
        percent: Math.round(ratio * 100),
      };
      metricsRef.current = next;
      setMetrics((previous) =>
        Object.keys(next).some(
          (key) =>
            next[key as keyof Metrics] !== previous[key as keyof Metrics],
        )
          ? next
          : previous,
      );
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }
    function onScroll() {
      reveal();
      schedule();
    }
    const resize = new ResizeObserver(schedule);
    resize.observe(scroll);
    resize.observe(track);
    const content = new MutationObserver(schedule);
    content.observe(scroll, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    scroll.addEventListener("scroll", onScroll, { passive: true });
    scroll.addEventListener("load", schedule, true);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(hideTimer.current);
      resize.disconnect();
      content.disconnect();
      scroll.removeEventListener("scroll", onScroll);
      scroll.removeEventListener("load", schedule, true);
      drag.current = null;
    };
  }, [scrollRef, routeKey]);

  function move(clientY: number) {
    const track = trackRef.current;
    const scroll = scrollRef.current;
    if (!track || !scroll || !drag.current) return;
    const current = metricsRef.current;
    const ratio =
      (clientY - track.getBoundingClientRect().top - drag.current.offset) /
      Math.max(1, current.track - current.thumb);
    scroll.scrollTop = Math.max(0, Math.min(1, ratio)) * current.range;
    reveal();
  }

  return (
    <div
      ref={trackRef}
      className={`overlay-scrollbar ${active ? "scrollbar-active" : ""}`}
      role="scrollbar"
      aria-label="Scroll page"
      aria-orientation="vertical"
      aria-controls="scroll-view"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={metrics.percent}
      aria-hidden={metrics.range <= 1}
      tabIndex={metrics.range > 1 ? 0 : -1}
      data-overflow={metrics.range > 1}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const current = metricsRef.current;
        const y =
          event.clientY - event.currentTarget.getBoundingClientRect().top;
        drag.current = {
          offset:
            y >= current.top && y <= current.top + current.thumb
              ? y - current.top
              : current.thumb / 2,
        };
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        move(event.clientY);
      }}
      onPointerMove={(event) => {
        if (drag.current) move(event.clientY);
      }}
      onPointerUp={(event) => {
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        reveal();
      }}
      onLostPointerCapture={() => {
        drag.current = null;
        reveal();
      }}
      onKeyDown={(event) => {
        const scroll = scrollRef.current;
        if (!scroll) return;
        const steps: Record<string, number> = {
          ArrowDown: 40,
          ArrowUp: -40,
          PageDown: scroll.clientHeight * 0.85,
          PageUp: -scroll.clientHeight * 0.85,
          Home: -scroll.scrollHeight,
          End: scroll.scrollHeight,
        };
        if (!(event.key in steps)) return;
        event.preventDefault();
        scroll.scrollTop += steps[event.key];
        reveal();
      }}
    >
      <div
        className="overlay-scrollbar-thumb"
        style={{
          height: metrics.thumb,
          transform: `translateY(${metrics.top}px)`,
        }}
      />
    </div>
  );
}
