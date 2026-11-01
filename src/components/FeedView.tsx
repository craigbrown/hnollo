import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, History, EyeOff, Check } from "lucide-react";
import type { Feed, HNItem, StoryOrder, TopPeriod, ItemActionHandler } from "../types";
import { topPeriods } from "../types";
import { getFeed, getItems, getTopStories, seedItems } from "../api";
import { useReader } from "../store";
import { Post } from "./Post";
import { Empty, ErrorState, Loading, Skeletons } from "./Common";
import { useScrollSurface } from "./ScrollSurface";

interface FeedCache {
  ids: number[];
  items: HNItem[];
  offset: number;
  page: number;
  more: boolean;
  since?: number;
}
const feedCache = new Map<string, FeedCache>();
export function FeedView({
  feed,
  order,
  period,
  refresh,
  hideRead,
  onActions,
  onRefreshComplete,
}: {
  feed: Feed;
  order: StoryOrder;
  period: TopPeriod;
  refresh: number;
  hideRead: boolean;
  onActions: ItemActionHandler;
  onRefreshComplete: () => void;
}) {
  const { active } = useScrollSurface();
  const key = `${feed}/${order}/${period}`;
  const initial = refresh ? undefined : feedCache.get(key);
  const [data, setData] = useState<FeedCache>(
    initial ?? { ids: [], items: [], offset: 0, page: 0, more: false },
  );
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState(false);
  const [partial, setPartial] = useState(false);
  const [retry, setRetry] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const state = useReader();
  const infinite = feed === "top";
  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    const cached = feedCache.get(key);
    if (cached && !refresh && !retry) {
      setData(cached);
      setLoading(false);
      busy.current = false;
      return () => {
        controller.abort();
        generation.current++;
      };
    }
    busy.current = true;
    setLoading(true);
    setError(false);
    setPartial(false);
    async function load() {
      let next: FeedCache;
      if (order === "top") {
        const seconds = topPeriods.find(
          (option) => option.id === period,
        )?.seconds;
        const since = seconds
          ? Math.floor(Date.now() / 1000) - seconds
          : undefined;
        const result = await getTopStories(feed, since, 0, controller.signal);
        next = {
          ids: [],
          items: result.items,
          offset: 20,
          page: 0,
          more: result.pages > 1 && result.items.length > 0,
          since,
        };
      } else {
        const ids = await getFeed(feed, order, controller.signal);
        const result = await getItems(ids.slice(0, 20), !!refresh);
        if (!result.items.length && result.failed)
          throw new Error("Failed to load");
        if (current === generation.current) setPartial(!!result.failed);
        next = {
          ids,
          items: result.items,
          offset: 20,
          page: 0,
          more: ids.length > 20,
        };
      }
      if (controller.signal.aborted || current !== generation.current) return;
      feedCache.set(key, next);
      setData(next);
    }
    load()
      .catch(() => {
        if (!controller.signal.aborted && current === generation.current)
          setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted && current === generation.current) {
          busy.current = false;
          setLoading(false);
          onRefreshComplete();
        }
      });
    return () => {
      controller.abort();
      generation.current++;
    };
  }, [feed, order, period, key, refresh, retry, onRefreshComplete]);

  const more = useCallback(async () => {
    if (busy.current || !data.more) return;
    const current = generation.current;
    busy.current = true;
    setLoading(true);
    setError(false);
    try {
      let next: FeedCache;
      if (order === "top") {
        const result = await getTopStories(feed, data.since, data.page + 1);
        next = {
          ...data,
          items: [...data.items, ...result.items],
          page: data.page + 1,
          more: data.page + 2 < result.pages && result.items.length > 0,
        };
      } else {
        const result = await getItems(
          data.ids.slice(data.offset, data.offset + 20),
        );
        if (!result.items.length && result.failed)
          throw new Error("Failed to load");
        if (current === generation.current) setPartial(!!result.failed);
        next = {
          ...data,
          items: [...data.items, ...result.items],
          offset: data.offset + 20,
          more: data.offset + 20 < data.ids.length,
        };
      }
      if (current !== generation.current) return;
      const unique = new Set<number>();
      next.items = next.items.filter((item) => {
        if (unique.has(item.id)) return false;
        unique.add(item.id);
        return true;
      });
      feedCache.set(key, next);
      setData(next);
    } catch {
      if (current === generation.current) setError(true);
    } finally {
      if (current === generation.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, [data, feed, order, key]);

  useEffect(() => {
    if (!active || !infinite || !data.more || loading || error || !sentinel.current)
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void more();
      },
      {
        root: null,
        rootMargin: "0px 0px 450px 0px",
      },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [active, infinite, data.more, loading, error, more]);

  const posts = data.items.filter((item) => !hideRead || !state.posts[item.id]);
  if (loading && !data.items.length) return <Skeletons />;
  if (error && !data.items.length)
    return <ErrorState onRetry={() => setRetry((value) => value + 1)} />;
  return (
    <>
      {partial && (
        <div className="notice">
          Some stories couldn’t load. Refresh to try again.
        </div>
      )}
      {posts.map((item) => (
        <Post key={item.id} item={item} onActions={onActions} />
      ))}
      {!posts.length && (
        <Empty
          icon={<EyeOff size={40} strokeWidth={1.2} />}
          title={
            hideRead && data.items.length
              ? "You’re all caught up"
              : "No stories yet"
          }
        >
          {hideRead && data.items.length
            ? "Read posts are hidden. Turn off “Hide Read Posts” to see them again."
            : order === "top"
              ? "There aren’t any stories in this timeframe. Try a longer period."
              : "There aren’t any stories in this feed right now."}
        </Empty>
      )}
      {loading ? (
        <Loading label="Loading more stories…" />
      ) : error ? (
        <ErrorState onRetry={more} message="Couldn’t load more stories." />
      ) : data.more ? (
        infinite ? null : (
          <button className="load-more" onClick={more}>
            Load more stories
          </button>
        )
      ) : (
        posts.length > 0 && (
          <div className="end-note">
            <Check size={16} /> You’re all caught up
          </div>
        )
      )}
      {infinite && data.more && (
        <div
          ref={sentinel}
          className="infinite-scroll-sentinel"
          aria-hidden="true"
        />
      )}
      {!data.more && (
        <div className="feed-footnote">Hacker News, a little more at home.</div>
      )}
    </>
  );
}
export function LibraryView({
  mode,
  onActions,
  layout,
}: {
  mode: "saved" | "history";
  onActions: ItemActionHandler;
  layout: "large" | "compact";
}) {
  const state = useReader();
  const items = state[mode];
  useEffect(() => {
    seedItems(items);
  }, [items]);
  return items.length ? (
    <>
      {items.map((item) => (
        <Post item={item} onActions={onActions} layout={layout} key={item.id} />
      ))}
    </>
  ) : (
    <Empty
      icon={
        mode === "saved" ? (
          <Bookmark size={42} strokeWidth={1.2} />
        ) : (
          <History size={42} strokeWidth={1.2} />
        )
      }
      title={
        mode === "saved" ? "Save something for later" : "Your reading history"
      }
    >
      {mode === "saved"
        ? "Your saved posts will appear here."
        : "Posts you open will appear here."}
    </Empty>
  );
}
