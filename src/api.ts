import type { Feed, HNItem, StoryOrder } from "./types";

const API = "https://hacker-news.firebaseio.com/v0";
const cache = new Map<number, { item: HNItem; at: number }>();
const pending = new Map<number, Promise<HNItem | null>>();
let active = 0;
const queue: (() => void)[] = [];

async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 10) await new Promise<void>((resolve) => queue.push(resolve));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    queue.shift()?.();
  }
}

export async function fetchJSON<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 15000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export function seedItems(items: HNItem[]) {
  items.forEach((item) => {
    if (!cache.has(item.id)) cache.set(item.id, { item, at: 0 });
  });
}
export function peekItem(id: number) {
  return cache.get(id)?.item;
}

export function getItem(id: number, refresh = false): Promise<HNItem | null> {
  const cached = cache.get(id);
  if (!refresh && cached && Date.now() - cached.at < 120000)
    return Promise.resolve(cached.item);
  const request = pending.get(id);
  if (request) return request;
  const promise = limited(async () => {
    try {
      const item = await fetchJSON<HNItem | null>(`${API}/item/${id}.json`);
      if (item) cache.set(id, { item, at: Date.now() });
      return item;
    } catch (error) {
      if (cached && !refresh) return cached.item;
      throw error;
    }
  }).finally(() => pending.delete(id));
  pending.set(id, promise);
  return promise;
}

export async function getItems(ids: number[], refresh = false) {
  const results = await Promise.allSettled(
    ids.map((id) => getItem(id, refresh)),
  );
  const items = results.flatMap((result) =>
    result.status === "fulfilled" &&
    result.value &&
    !result.value.dead &&
    !result.value.deleted
      ? [result.value]
      : [],
  );
  return {
    items,
    failed: results.filter((result) => result.status === "rejected").length,
  };
}

export async function getCommentContext(id: number, refresh = false) {
  const comments: HNItem[] = [];
  const seen = new Set<number>();
  let current = id;
  while (!seen.has(current)) {
    seen.add(current);
    const item = await getItem(current, refresh);
    if (!item) break;
    if (item.type !== "comment") {
      if (comments.length && ["story", "poll", "job"].includes(item.type ?? ""))
        return { story: item, comments: comments.reverse() };
      break;
    }
    comments.push(item);
    const parent = item.parent;
    if (parent === undefined || !Number.isSafeInteger(parent) || parent <= 0) break;
    current = parent;
  }
  throw new Error("Comment context is unavailable");
}
export async function getFeed(
  feed: Feed,
  order: StoryOrder = "ranked",
  signal?: AbortSignal,
) {
  const endpoint = feed === "top" && order === "new" ? "new" : feed;
  const ids = await fetchJSON<number[]>(
    `${API}/${endpoint}stories.json`,
    signal,
  );
  return order === "new" && feed !== "top"
    ? [...ids].sort((a, b) => b - a)
    : ids;
}

interface SearchResult {
  hits: {
    objectID: string;
    title: string;
    url?: string;
    author: string;
    points: number;
    num_comments: number;
    created_at_i: number;
  }[];
  nbPages: number;
}
export async function searchStories(
  query: string,
  page: number,
  newest: boolean,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    query,
    tags: "story",
    hitsPerPage: "25",
    page: String(page),
  });
  const result = await fetchJSON<SearchResult>(
    `https://hn.algolia.com/api/v1/${newest ? "search_by_date" : "search"}?${params}`,
    signal,
  );
  const items: HNItem[] = result.hits.map((hit) => ({
    id: Number(hit.objectID),
    title: hit.title,
    by: hit.author,
    url: hit.url,
    score: hit.points,
    descendants: hit.num_comments,
    time: hit.created_at_i,
    type: "story",
  }));
  // Search results omit the comment IDs; never replace complete Firebase items with them.
  return { items, pages: result.nbPages };
}

interface CommentSearchResponse {
  hits: {
    objectID: string;
    author: string;
    comment_text: string;
    created_at_i: number;
  }[];
  nbPages: number;
  nbHits: number;
}
export async function searchComments(
  query: string,
  story: number,
  page: number,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    query,
    tags: `comment,story_${story}`,
    hitsPerPage: "30",
    page: String(page),
  });
  const result = await fetchJSON<CommentSearchResponse>(
    `https://hn.algolia.com/api/v1/search?${params}`,
    signal,
  );
  return {
    items: result.hits.map((hit) => ({
      id: Number(hit.objectID),
      by: hit.author,
      text: hit.comment_text,
      time: hit.created_at_i,
    })),
    pages: result.nbPages,
    total: result.nbHits,
  };
}

const users = new Map<
  string,
  { user: import("./types").HNUser | null; at: number }
>();
export function peekUser(name: string) {
  return users.get(name)?.user;
}
export async function getUser(name: string, refresh = false) {
  const cached = users.get(name);
  if (!refresh && cached && Date.now() - cached.at < 300000) return cached.user;
  const user = await fetchJSON<import("./types").HNUser | null>(
    `${API}/user/${encodeURIComponent(name)}.json`,
  );
  users.set(name, { user, at: Date.now() });
  return user;
}
interface ActivityResponse {
  hits: {
    objectID: string;
    _tags?: string[];
    author: string;
    title?: string;
    url?: string;
    points?: number;
    num_comments?: number;
    created_at_i: number;
    comment_text?: string;
    story_id?: number;
    story_title?: string;
  }[];
  nbPages: number;
}
export async function getUserActivity(
  name: string,
  section: "overview" | "posts" | "comments",
  page = 0,
  signal?: AbortSignal,
) {
  const tags = [
    `author_${name}`,
    ...(section === "posts"
      ? ["story"]
      : section === "comments"
        ? ["comment"]
        : []),
  ].join(",");
  const params = new URLSearchParams({
    tags,
    hitsPerPage: "20",
    page: String(page),
  });
  const result = await fetchJSON<ActivityResponse>(
    `https://hn.algolia.com/api/v1/search_by_date?${params}`,
    signal,
  );
  const items: import("./types").UserActivity[] = result.hits.map((hit) => ({
    id: Number(hit.objectID),
    type:
      hit._tags?.includes("comment") || hit.comment_text != null
        ? "comment"
        : "story",
    by: hit.author,
    time: hit.created_at_i,
    title: hit.title,
    url: hit.url,
    score: hit.points,
    descendants: hit.num_comments,
    text: hit.comment_text,
    storyId: hit.story_id,
    storyTitle: hit.story_title,
  }));
  return { items, pages: result.nbPages };
}

// An empty Algolia query ranks by points. Fix the lower time boundary for the
// lifetime of a paginated feed so it does not drift between infinite-scroll pages.
export async function getTopStories(
  feed: Feed,
  since: number | undefined,
  page: number,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    query: "",
    tags:
      feed === "ask"
        ? "story,ask_hn"
        : feed === "show"
          ? "story,show_hn"
          : feed === "job"
            ? "job"
            : "story",
    hitsPerPage: "20",
    page: String(page),
  });
  if (since !== undefined)
    params.set("numericFilters", `created_at_i>${since}`);
  const result = await fetchJSON<SearchResult>(
    `https://hn.algolia.com/api/v1/search?${params}`,
    signal,
  );
  const items: HNItem[] = result.hits
    .filter((hit) => hit.title && Number.isSafeInteger(Number(hit.objectID)))
    .map((hit) => ({
      id: Number(hit.objectID),
      title: hit.title,
      by: hit.author,
      url: hit.url,
      score: hit.points,
      descendants: hit.num_comments,
      time: hit.created_at_i,
      type: feed === "job" ? "job" : "story",
    }));
  return { items, pages: result.nbPages };
}
