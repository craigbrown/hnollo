import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { goBack, goForward } from "./navigation";

const EDGE = 26;
const SETTLE_MS = 260;

export type SwipeDirection = "back" | "forward";
interface EdgeGesture {
  direction: SwipeDirection;
  x: number;
  y: number;
  target: Element;
  started: boolean;
  // A vertical drag, scrolled by hand since its touch was cancelled.
  scrolling: boolean;
  lastY: number;
  // Only blocks the system gesture: this tab has no page in that direction.
  blocked: boolean;
  // Where the upper page is: the current one going back, the next one forward.
  offset: number;
  velocity: number;
  time: number;
}

const root = () => document.documentElement;
function setOffset(offset: number) {
  root().style.setProperty("--edge-swipe", `${offset}px`);
  root().style.setProperty(
    "--edge-swipe-progress", `${Math.min(1, offset / window.innerWidth)}`,
  );
}
// A cancelled touch produces no click or focus, so a tap has to be replayed.
function tap(target: Element) {
  const control = target.closest("label")?.control ??
    target.closest("input, textarea, select");
  if (control instanceof HTMLElement) control.focus();
  let element: Element | null = target;
  while (element && !(element instanceof HTMLElement)) element = element.parentElement;
  element?.click();
}
function clear() {
  root().classList.remove(
    "edge-swiping", "edge-swiping-back", "edge-swiping-forward",
    "edge-swipe-settling",
  );
  root().style.removeProperty("--edge-swipe");
  root().style.removeProperty("--edge-swipe-progress");
}

// Swipes from the left edge slide the current page off the previous one in the
// same tab, and swipes from the right edge slide back the page it came from.
// Returns the other page while it needs drawing.
export function useEdgeSwipe(stack: string[], forward: string | undefined) {
  const [page, setPage] = useState<{ hash: string; direction: SwipeDirection }>();
  const targets = useRef({ back: stack.at(-2), forward });
  targets.current = { back: stack.at(-2), forward };
  const finishing = useRef(false);
  const settling = useRef<ReturnType<typeof setTimeout>>(undefined);
  useLayoutEffect(() => {
    // The other page has become the current one, so its stand-in can go before
    // the next paint.
    if (!finishing.current) return;
    finishing.current = false;
    clearTimeout(settling.current);
    settling.current = undefined;
    clear();
    setPage(undefined);
  }, [stack]);
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let gesture: EdgeGesture | null = null;
    function reset() {
      clear();
      setPage(undefined);
    }
    function settle(direction: SwipeDirection, complete: boolean) {
      root().classList.add("edge-swipe-settling");
      setOffset((direction === "back") === complete ? window.innerWidth : 0);
      settling.current = setTimeout(() => {
        settling.current = undefined;
        if (!complete) {
          reset();
          return;
        }
        finishing.current = true;
        if (direction === "back") goBack();
        else goForward();
        // Browser history can refuse to move, so never leave a page offscreen.
        settling.current = setTimeout(() => {
          settling.current = undefined;
          if (!finishing.current) return;
          finishing.current = false;
          reset();
        }, 1000);
      }, SETTLE_MS);
    }
    function start(event: TouchEvent) {
      gesture = null;
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      const target = event.target as Element;
      const direction: SwipeDirection | undefined =
        touch.clientX < EDGE ? "back"
          : touch.clientX > window.innerWidth - EDGE ? "forward"
            : undefined;
      if (
        !direction || document.querySelector("dialog[open]") ||
        target.closest(".overlay-scrollbar.scrollbar-active")
      ) return;
      const blocked = !!settling.current || !targets.current[direction];
      // In a browser tab, Safari's own swipes are its Back and Forward buttons,
      // so leave them alone where this tab has nowhere to go.
      if (blocked && !standalone && !settling.current) return;
      // Cancelling the touch itself is the only reliable way to stop iOS's own
      // history swipes, which walk browser history across tabs: on a busy page,
      // cancelling its first move can come too late. Taps and vertical drags
      // from the edge are replayed instead.
      if (event.cancelable) event.preventDefault();
      gesture = {
        direction, x: touch.clientX, y: touch.clientY, target,
        started: false, scrolling: false, lastY: touch.clientY, blocked,
        offset: direction === "back" ? 0 : window.innerWidth,
        velocity: 0, time: event.timeStamp,
      };
    }
    function move(event: TouchEvent) {
      const current = gesture;
      if (!current) return;
      if (event.touches.length !== 1) {
        gesture = null;
        if (current.started && !current.blocked) settle(current.direction, false);
        return;
      }
      const touch = event.touches[0];
      const dx = touch.clientX - current.x;
      const dy = touch.clientY - current.y;
      if (event.cancelable) event.preventDefault();
      if (!current.started && !current.scrolling) {
        // Leave room for a tap to wobble.
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        current.scrolling =
          Math.abs(dy) > Math.abs(dx) ||
          (current.direction === "back" ? dx < 0 : dx > 0);
        current.started = !current.scrolling;
        if (current.started && !current.blocked) {
          root().classList.add("edge-swiping", `edge-swiping-${current.direction}`);
          setOffset(current.offset);
          setPage({
            hash: targets.current[current.direction]!,
            direction: current.direction,
          });
        }
      }
      if (current.scrolling) {
        window.scrollBy(0, current.lastY - touch.clientY);
        current.lastY = touch.clientY;
        return;
      }
      if (current.blocked) return;
      const width = window.innerWidth;
      const offset = Math.min(width, Math.max(0,
        current.direction === "back" ? dx : width + dx));
      const elapsed = event.timeStamp - current.time;
      if (elapsed > 0)
        current.velocity = 0.6 * current.velocity +
          0.4 * (offset - current.offset) / elapsed;
      current.offset = offset;
      current.time = event.timeStamp;
      setOffset(offset);
    }
    function end(event: TouchEvent) {
      const current = gesture;
      gesture = null;
      if (!current) return;
      if (event.cancelable) event.preventDefault();
      if (!current.started) {
        if (!current.scrolling && event.type === "touchend") tap(current.target);
        return;
      }
      if (current.blocked) return;
      // Velocity is in the direction of the swipe, in pixels per millisecond.
      const recent = event.timeStamp - current.time < 100;
      const velocity = (recent ? current.velocity : 0) *
        (current.direction === "back" ? 1 : -1);
      const distance = current.direction === "back"
        ? current.offset : window.innerWidth - current.offset;
      settle(
        current.direction,
        event.type === "touchend" && velocity > -0.2 &&
          (velocity > 0.5 || distance > window.innerWidth / 2),
      );
    }
    document.addEventListener("touchstart", start, { passive: false });
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", end, { passive: false });
    document.addEventListener("touchcancel", end);
    return () => {
      clearTimeout(settling.current);
      clear();
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", end);
    };
  }, []);
  return page;
}
