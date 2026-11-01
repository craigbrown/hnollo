import { useSyncExternalStore } from "react";
import type { HNItem } from "./types";

export const STORAGE_KEY = "hnollo:v1";
export interface Preferences {
  theme: "light" | "dark" | "system";
  layout: "large" | "compact";
  historyLayout: "large" | "compact";
  savedLayout?: "large" | "compact";
  textSize: "small" | "medium" | "large";
  twitterDisplay: "embedded" | "previews";
  youtubeDisplay: "embedded" | "previews";
  dimRead: boolean;
}
export interface DiscussionVisit {
  seenAt: number;
  count: number;
  unread: number;
  newAfter: number;
}
export interface ReadComment {
  id: number;
  storyId?: number;
  time?: number;
}
export interface ReaderState {
  version: 1;
  posts: Record<string, number>;
  comments: Record<string, number>;
  collapsedComments: Record<string, number>;
  discussions: Record<string, DiscussionVisit>;
  saved: HNItem[];
  history: HNItem[];
  searches: string[];
  preferences: Preferences;
}
const defaults: Preferences = {
  theme: "system",
  layout: "large",
  historyLayout: "compact",
  textSize: "medium",
  twitterDisplay: "embedded",
  youtubeDisplay: "embedded",
  dimRead: true,
};
export function emptyState(): ReaderState {
  return {
    version: 1,
    posts: {},
    comments: {},
    collapsedComments: {},
    discussions: {},
    saved: [],
    history: [],
    searches: [],
    preferences: { ...defaults },
  };
}
function validItem(item: unknown): item is HNItem {
  return (
    !!item &&
    typeof item === "object" &&
    "id" in item &&
    Number.isSafeInteger(item.id) &&
    Number(item.id) > 0
  );
}
function timestamps(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([id, time]) =>
          /^\d+$/.test(id) && typeof time === "number" && Number.isFinite(time),
      )
      .slice(-20000),
  );
}
function visits(value: unknown): Record<string, DiscussionVisit> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([id, visit]) =>
          /^\d+$/.test(id) &&
          visit &&
          ["seenAt", "count", "unread", "newAfter"].every(
            (key) =>
              typeof visit[key] === "number" &&
              Number.isFinite(visit[key]) &&
              visit[key] >= 0,
          ),
      )
      .slice(-2000),
  );
}
export function parseState(raw: string | null): ReaderState {
  try {
    if (!raw) return emptyState();
    const value = JSON.parse(raw);
    if (value.version !== 1) return emptyState();
    const p = value.preferences ?? {};
    const posts = timestamps(value.posts);
    const history = Array.isArray(value.history)
      ? value.history.filter(validItem).slice(0, 300)
      : [];
    const discussions = visits(value.discussions);
    // Preserve the baseline of discussions opened before this field was added.
    if (!value.discussions)
      history.forEach((item: HNItem) => {
        if (posts[item.id] && item.descendants !== undefined)
          discussions[item.id] = {
            seenAt: posts[item.id],
            count: item.descendants,
            unread: 0,
            newAfter: posts[item.id],
          };
      });
    return {
      version: 1,
      posts,
      comments: timestamps(value.comments),
      collapsedComments: timestamps(value.collapsedComments),
      discussions,
      saved: Array.isArray(value.saved)
        ? value.saved.filter(validItem).slice(0, 500)
        : [],
      history,
      searches: Array.isArray(value.searches)
        ? [
            ...new Map<string, string>(
              value.searches
                .filter(
                  (query: unknown): query is string =>
                    typeof query === "string",
                )
                .map((query: string) => query.trim().slice(0, 200))
                .filter(Boolean)
                .map((query: string) => [query.toLowerCase(), query]),
            ).values(),
          ].slice(0, 20)
        : [],
      preferences: {
        theme: ["light", "dark", "system"].includes(p.theme)
          ? p.theme
          : defaults.theme,
        layout: ["large", "compact"].includes(p.layout)
          ? p.layout
          : defaults.layout,
        historyLayout: ["large", "compact"].includes(p.historyLayout)
          ? p.historyLayout
          : defaults.historyLayout,
        savedLayout: ["large", "compact"].includes(p.savedLayout)
          ? p.savedLayout
          : undefined,
        textSize: ["small", "medium", "large"].includes(p.textSize)
          ? p.textSize
          : defaults.textSize,
        twitterDisplay: ["embedded", "previews"].includes(p.twitterDisplay)
          ? p.twitterDisplay
          : defaults.twitterDisplay,
        youtubeDisplay: ["embedded", "previews"].includes(p.youtubeDisplay)
          ? p.youtubeDisplay
          : defaults.youtubeDisplay,
        dimRead: typeof p.dimRead === "boolean" ? p.dimRead : defaults.dimRead,
      },
    };
  } catch {
    return emptyState();
  }
}
function load() {
  try {
    return parseState(localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptyState();
  }
}
let state = load();
let storageAvailable = true;
const listeners = new Set<() => void>();
function update(next: ReaderState) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  listeners.forEach((fn) => fn());
}
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY || event.key === null) {
    state = load();
    listeners.forEach((fn) => fn());
  }
});
export function newCommentCount(item: HNItem, visit?: DiscussionVisit) {
  return visit
    ? Math.min(
        item.descendants ?? 0,
        visit.unread + Math.max(0, (item.descendants ?? 0) - visit.count),
      )
    : 0;
}
export function isCommentRead(item: HNItem, storyId?: number) {
  const visit = storyId ? state.discussions[storyId] : undefined;
  return (
    !!state.comments[item.id] ||
    (!!visit && (!item.time || item.time * 1000 <= visit.seenAt))
  );
}
function postState(item: HNItem) {
  return {
    posts: trim({ ...state.posts, [item.id]: Date.now() }, 5000),
    history: [item, ...state.history.filter((i) => i.id !== item.id)].slice(
      0,
      300,
    ),
  };
}
export const reader = {
  get: () => state,
  storageAvailable: () => storageAvailable,
  setCommentCollapsed(id: number, collapsed: boolean) {
    const collapsedComments = { ...state.collapsedComments };
    if (collapsed) collapsedComments[id] = Date.now();
    else delete collapsedComments[id];
    update({ ...state, collapsedComments: trim(collapsedComments, 20000) });
  },
  markPost(item: HNItem) {
    update({ ...state, ...postState(item) });
  },
  openDiscussion(item: HNItem): DiscussionVisit {
    const previous = state.discussions[item.id];
    const now = Date.now();
    const visit = {
      seenAt: now,
      count: item.descendants ?? 0,
      unread: newCommentCount(item, previous),
      newAfter: previous
        ? previous.unread
          ? previous.newAfter
          : previous.seenAt
        : now,
    };
    const discussions = Object.fromEntries(
      Object.entries<DiscussionVisit>({
        ...state.discussions,
        // Persist the whole discussion as read; return the opening snapshot
        // separately so new replies stay highlighted during this visit.
        [item.id]: { ...visit, unread: 0, newAfter: now },
      })
        .sort((a, b) => b[1].seenAt - a[1].seenAt)
        .slice(0, 2000),
    );
    update({ ...state, ...postState(item), discussions });
    return visit;
  },
  markComments(entries: ReadComment[]) {
    const unread = entries.filter((entry) => !state.comments[entry.id]);
    if (!unread.length) return;
    const comments = { ...state.comments };
    const discussions = { ...state.discussions };
    unread.forEach((entry) => {
      if (comments[entry.id]) return;
      comments[entry.id] = Date.now();
      const visit = entry.storyId ? discussions[entry.storyId] : undefined;
      if (
        entry.storyId &&
        visit?.unread &&
        entry.time &&
        entry.time * 1000 > visit.newAfter
      )
        discussions[entry.storyId] = {
          ...visit,
          unread: Math.max(0, visit.unread - 1),
        };
    });
    update({ ...state, comments: trim(comments, 20000), discussions });
  },
  toggleSaved(item: HNItem) {
    update({
      ...state,
      saved: state.saved.some((i) => i.id === item.id)
        ? state.saved.filter((i) => i.id !== item.id)
        : [item, ...state.saved].slice(0, 500),
    });
  },
  rememberSearch(query: string) {
    const value = query.trim().slice(0, 200);
    if (!value) return;
    update({
      ...state,
      searches: [
        value,
        ...state.searches.filter(
          (entry) => entry.toLowerCase() !== value.toLowerCase(),
        ),
      ].slice(0, 20),
    });
  },
  removeSearch(query: string) {
    update({
      ...state,
      searches: state.searches.filter((entry) => entry !== query),
    });
  },
  setPreferences(preferences: Partial<Preferences>) {
    update({ ...state, preferences: { ...state.preferences, ...preferences } });
  },
  clearHistory() {
    update({
      ...state,
      posts: {},
      comments: {},
      collapsedComments: {},
      discussions: {},
      history: [],
      searches: [],
    });
  },
  markUnread(id: number) {
    const posts = { ...state.posts };
    delete posts[id];
    update({
      ...state,
      posts,
      history: state.history.filter((i) => i.id !== id),
    });
  },
};
function trim(record: Record<string, number>, limit: number) {
  const entries = Object.entries(record);
  return entries.length <= limit
    ? record
    : Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, limit));
}
export function useReader() {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    () => state,
  );
}
