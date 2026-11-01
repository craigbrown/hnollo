import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { HNItem } from "../types";
import { useScrollSurface } from "./ScrollSurface";
import { pageScrollTop, pageViewport, scrollPage } from "../pageScroll";

export function useCommentPosition(
  commentId: number | undefined,
  context: HNItem[] | undefined,
  query: string,
  discussion: RefObject<HTMLDivElement | null>,
) {
  const { contentRef, active } = useScrollSurface();
  const positioned = useRef(false);
  useEffect(() => {
    const root = contentRef.current;
    const content = discussion.current;
    if (
      !active || !commentId || !context || query.trim() ||
      positioned.current || !root || !content
    )
      return;
    let stopped = false;
    let frame = 0;
    function position() {
      if (stopped) return;
      const row = content!.querySelector<HTMLElement>(".comment-focused");
      if (!row) return;
      const shell = root!.closest(".app-shell");
      const viewport = pageViewport();
      const header = shell?.querySelector(".navigation-bar")
        ?.getBoundingClientRect();
      const tabs = shell?.querySelector(".tab-bar")?.getBoundingClientRect();
      const top = Math.max(viewport.top, header?.bottom ?? viewport.top) + 8;
      const bottom = Math.min(viewport.bottom, tabs?.top ?? viewport.bottom) - 12;
      const bounds = row.getBoundingClientRect();
      // Fit the comment above the floating tabs, keeping the maximum preceding
      // context visible. Oversized comments start at their first line instead.
      const delta = bounds.height > bottom - top
        ? bounds.top - top
        : bounds.bottom - bottom;
      scrollPage(pageScrollTop() + delta);
      positioned.current = true;
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(position);
    }
    const resize = new ResizeObserver(schedule);
    function dispose() {
      stopped = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      root!.removeEventListener("load", schedule, true);
    }
    function stop() {
      positioned.current = true;
      dispose();
    }
    // Publisher preview images may change the height above the comment. Keep
    // its initial placement stable until the reader starts interacting.
    resize.observe(content);
    root.addEventListener("load", schedule, true);
    const interactions = ["wheel", "touchstart", "pointerdown", "keydown"];
    interactions.forEach((event) =>
      window.addEventListener(event, stop, { passive: true }));
    schedule();
    return () => {
      dispose();
      interactions.forEach((event) => window.removeEventListener(event, stop));
    };
  }, [active, commentId, context, query, contentRef, discussion]);
}
