import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { pageScrollHeight, pageScrollTop, pageViewport, scrollPage } from "../pageScroll";

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
  contentRef,
  routeKey,
  scrollId,
  enabled,
}: {
  contentRef: RefObject<HTMLElement | null>;
  routeKey: string;
  scrollId: string;
  enabled: boolean;
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
    const scroll = contentRef.current;
    const track = trackRef.current;
    if (!enabled || !scroll || !track) return;
    setActive(false);
    let frame = 0;
    function measure() {
      const viewport = pageViewport().height;
      const total = pageScrollHeight();
      const range = Math.max(0, total - viewport);
      const height = track!.clientHeight;
      const thumb = Math.min(
        height,
        Math.max(
          30,
          (height * viewport) / Math.max(total, 1),
        ),
      );
      const ratio = range
        ? Math.min(1, Math.max(0, pageScrollTop() / range))
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
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    scroll.addEventListener("load", schedule, true);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(hideTimer.current);
      resize.disconnect();
      content.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      scroll.removeEventListener("load", schedule, true);
      drag.current = null;
    };
  }, [contentRef, routeKey, enabled]);

  function move(clientY: number) {
    const track = trackRef.current;
    const scroll = contentRef.current;
    if (!track || !scroll || !drag.current) return;
    const current = metricsRef.current;
    const ratio =
      (clientY - track.getBoundingClientRect().top - drag.current.offset) /
      Math.max(1, current.track - current.thumb);
    scrollPage(Math.max(0, Math.min(1, ratio)) * current.range);
    reveal();
  }

  return (
    <div
      ref={trackRef}
      className={`overlay-scrollbar ${active ? "scrollbar-active" : ""}`}
      role="scrollbar"
      aria-label="Scroll page"
      aria-orientation="vertical"
      aria-controls={scrollId}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={metrics.percent}
      aria-hidden={metrics.range <= 1}
      tabIndex={metrics.range > 1 ? 0 : -1}
      data-overflow={metrics.range > 1}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        // A finger can only grab the scrollbar while it's showing, so touches at
        // the screen edge otherwise reach the page and edge swipes.
        if (event.pointerType === "touch" && !active) return;
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
        const scroll = contentRef.current;
        if (!scroll) return;
        const steps: Record<string, number> = {
          ArrowDown: 40,
          ArrowUp: -40,
          PageDown: pageViewport().height * 0.85,
          PageUp: -pageViewport().height * 0.85,
          Home: -pageScrollHeight(),
          End: pageScrollHeight(),
        };
        if (!(event.key in steps)) return;
        event.preventDefault();
        scrollPage(pageScrollTop() + steps[event.key]);
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
