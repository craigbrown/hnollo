import { useEffect, useSyncExternalStore } from "react";
import { pageScrollTop, scrollPage } from "./pageScroll";

export const tabRoots = {
  posts: "#/feed/top",
  saved: "#/saved",
  history: "#/history",
  search: "#/search",
  settings: "#/settings",
};
export type TabId = keyof typeof tabRoots;
type TabState = { stack: string[]; visited: boolean };
type Navigation = { active: TabId; tabs: Record<TabId, TabState> };
type HistoryEntry = {
  tab: TabId;
  stack: string[];
  from?: { tab: TabId; hash: string };
};

const normalize = (path: string) =>
  path.startsWith("#") ? path : `#${path}`;
function owner(hash: string, fallback: TabId): TabId {
  const page = hash.replace(/^#\/?/, "").split("/")[0];
  if (page === "item" || page === "user") return fallback;
  return Object.hasOwn(tabRoots, page) ? page as TabId : "posts";
}
function historyEntry(): HistoryEntry | undefined {
  const entry = window.history.state?.hnolloTab;
  if (
    entry &&
    Object.hasOwn(tabRoots, entry.tab) &&
    Array.isArray(entry.stack) && entry.stack.length > 0 &&
    entry.stack.every((hash: unknown) =>
      typeof hash === "string" && hash.startsWith("#/")) &&
    entry.stack.at(-1) === window.location.hash
  ) return entry as HistoryEntry;
}
function initialNavigation(): Navigation {
  const hash = window.location.hash || tabRoots.posts;
  const entry = historyEntry();
  const active = entry?.tab ?? owner(hash, "posts");
  const tabs = Object.fromEntries(
    Object.entries(tabRoots).map(([tab, root]) => [tab, {
      stack: [root], visited: tab === active,
    }]),
  ) as Record<TabId, TabState>;
  tabs[active].stack = entry?.stack ?? (
    hash === tabRoots[active] ? [hash] : [tabRoots[active], hash]
  );
  return { active, tabs };
}

let navigation = initialNavigation();
const positions = new Map<string, number>();
export function rememberScrollPosition(tab: TabId, hash: string) {
  if (navigation.active === tab && navigation.tabs[tab].stack.at(-1) === hash)
    positions.set(`${tab}:${hash}`, Math.max(0, pageScrollTop()));
}
export function savedScrollPosition(tab: TabId, hash: string) {
  return positions.get(`${tab}:${hash}`) ?? 0;
}
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const getSnapshot = () => navigation;
// Pages each tab went back from, most recent last, for swiping forward again.
const forwards: Partial<Record<TabId, string[]>> = {};
export const forwardPage = (tab: TabId) => forwards[tab]?.at(-1);
function trackForward(tab: TabId, stack: string[]) {
  const previous = navigation.tabs[tab].stack;
  const same = (a: string[], b: string[]) =>
    a.length === b.length && a.every((hash, index) => hash === b[index]);
  if (same(stack, previous)) return;
  const forward = forwards[tab] ?? [];
  if (same(stack, previous.slice(0, -1))) forwards[tab] = [...forward, previous.at(-1)!];
  else if (same(stack.slice(0, -1), previous) && forward.at(-1) === stack.at(-1))
    forwards[tab] = forward.slice(0, -1);
  else forwards[tab] = [];
}
function activate(tab: TabId, stack: string[]) {
  if (tab === navigation.active && stack === navigation.tabs[tab].stack) return;
  trackForward(tab, stack);
  // Capture before the previous tab is hidden: a shorter destination can
  // immediately clamp the document's scroll position during the DOM update.
  rememberScrollPosition(navigation.active, navigation.tabs[navigation.active].stack.at(-1)!);
  navigation = {
    active: tab,
    tabs: { ...navigation.tabs, [tab]: { stack, visited: true } },
  };
  listeners.forEach((listener) => listener());
}
function writeHistory(tab: TabId, stack: string[], replace = false) {
  const from = {
    tab: navigation.active,
    hash: navigation.tabs[navigation.active].stack.at(-1)!,
  };
  const entry: HistoryEntry = { tab, stack, from };
  window.history[replace ? "replaceState" : "pushState"](
    { ...window.history.state, hnolloTab: entry }, "", stack.at(-1)!,
  );
  activate(tab, stack);
}

export function navigate(path: string, restoreScroll = false) {
  const hash = normalize(path);
  const tab = owner(hash, navigation.active);
  const stack = navigation.tabs[tab].stack;
  if (tab === navigation.active && stack.at(-1) === hash) return;
  if (stack.at(-1) === hash) {
    writeHistory(tab, stack);
    return;
  }
  // A page opened afresh starts at the top. Only going forward returns to
  // where the reader left it.
  if (!restoreScroll) positions.delete(`${tab}:${hash}`);
  writeHistory(tab, [...stack, hash]);
}
export function switchTab(tab: TabId) {
  if (tab !== navigation.active) {
    writeHistory(tab, navigation.tabs[tab].stack);
    return;
  }
  const stack = navigation.tabs[tab].stack;
  const current = stack.at(-1)!;
  const isFeed = (hash: string) => /^#\/feed(?:\/|$)/.test(hash);
  function scrollToTop() {
    scrollPage(0, window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant" : "smooth");
  }
  if (tab === "posts") {
    if (isFeed(current)) {
      if (pageScrollTop() > 1) scrollToTop();
      else writeHistory(tab, ["#/feeds"]);
    } else if (current === "#/feeds") {
      scrollToTop();
    } else {
      // Return straight to the selected feed, keeping its sort and scroll position.
      let feedIndex = stack.length - 1;
      while (feedIndex >= 0 && !isFeed(stack[feedIndex])) feedIndex--;
      writeHistory(tab, feedIndex >= 0
        ? stack.slice(0, feedIndex + 1) : [tabRoots.posts]);
    }
  } else if (tab === "saved" || tab === "history") {
    if (current !== tabRoots[tab]) writeHistory(tab, [tabRoots[tab]]);
    else scrollToTop();
  } else if (tab === "search") {
    if (current !== tabRoots.search) writeHistory(tab, [tabRoots.search]);
    else return "focus-search";
  } else if (current === tabRoots[tab]) {
    scrollToTop();
  }
}
export function goBack() {
  const tab = navigation.active;
  const stack = navigation.tabs[tab].stack;
  if (stack.length < 2) return;
  const previous = stack.at(-2)!;
  const from = historyEntry()?.from;
  if (from?.tab === tab && from.hash === previous) window.history.back();
  // After a tab switch the browser's previous entry belongs to another tab.
  // Pop this tab's own stack without taking the reader back to that other tab.
  else writeHistory(tab, stack.slice(0, -1), true);
}
export function goForward() {
  const hash = forwardPage(navigation.active);
  if (hash) navigate(hash, true);
}

export function useTabNavigation() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    // Keep the current tab's stack on browser history entries as well, so Back,
    // Forward and direct links all use the same navigation model.
    const tab = navigation.active;
    window.history.replaceState({
      ...window.history.state,
      hnolloTab: {
        tab, stack: navigation.tabs[tab].stack, from: historyEntry()?.from,
      },
    }, "", navigation.tabs[tab].stack.at(-1)!);
    function change() {
      const entry = historyEntry();
      if (entry) activate(entry.tab, entry.stack);
      else {
        const hash = window.location.hash || tabRoots.posts;
        const tab = owner(hash, navigation.active);
        const stack = hash === tabRoots[tab] ? [hash] : [tabRoots[tab], hash];
        writeHistory(tab, stack, true);
      }
    }
    window.addEventListener("popstate", change);
    window.addEventListener("hashchange", change);
    return () => {
      window.history.scrollRestoration = previousRestoration;
      window.removeEventListener("popstate", change);
      window.removeEventListener("hashchange", change);
    };
  }, []);
  return snapshot;
}
