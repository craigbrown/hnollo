import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  MessageCircle,
  MoreHorizontal,
  Search,
  X,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { HNItem } from "../types";
import type { DiscussionVisit } from "../store";
import { getItem, peekItem } from "../api";
import { reader, useReader, isCommentRead } from "../store";
import { timeAgo, userPath } from "../utils";
import { Post } from "./Post";
import { CommentSearch } from "./CommentSearch";
import { JumpIcon } from "./Icons";
import { Empty, ErrorState, Loading, RichText } from "./Common";
import { useScrollSurface } from "./ScrollSurface";

interface CommentProps {
  id: number;
  storyId: number;
  depth?: number;
  author?: string;
  visit: DiscussionVisit;
  readAtOpen: Set<number>;
  onActions: (item: HNItem) => void;
  forceRefresh: boolean;
}
function Comment({
  id,
  storyId,
  depth = 0,
  author,
  visit,
  readAtOpen,
  onActions,
  forceRefresh,
}: CommentProps) {
  const { scrollRef, active } = useScrollSurface();
  const [item, setItem] = useState<HNItem | null | undefined>(() =>
    peekItem(id),
  );
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [limit, setLimit] = useState(6);
  const [retry, setRetry] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  useReader();
  const read = !!item && isCommentRead(item, storyId);
  const isNew =
    visit.unread > 0 &&
    !readAtOpen.has(id) &&
    !!item?.time &&
    item.time * 1000 > visit.newAfter &&
    !item.dead &&
    !item.deleted;
  useEffect(() => {
    if (!active || ready) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setReady(true);
          observer.disconnect();
        }
      },
      { root: scrollRef.current, rootMargin: "500px 0px" },
    );
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, [active, ready, scrollRef]);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setFailed(false);
    getItem(id, retry > 0 || forceRefresh)
      .then((value) => {
        if (!cancelled) setItem(value);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id, ready, retry, forceRefresh]);
  const children = item?.kids ?? [];
  const style = {
    "--depth": Math.min(depth, 7),
    "--thread-color": depth
      ? ["#ed2525", "#f28b16", "#e3b728", "#20a75a", "#1683f8", "#a554ce"][
          (depth - 1) % 6
        ]
      : "transparent",
  } as CSSProperties;
  return (
    <div
      ref={container}
      className={`comment-node ${depth ? "nested-comment" : "root-comment"} ${read ? "comment-read" : ""}`}
      data-comment-id={id}
      data-loaded={!!item}
    >
      <div
        className={`comment-row ${isNew ? "comment-new" : ""} ${collapsed ? "comment-collapsed" : ""}`}
        style={style}
        data-depth={depth}
        data-new={isNew || undefined}
        aria-label={isNew ? `New comment by ${item?.by}` : undefined}
      >
        {failed ? (
          <button
            className="comment-retry"
            onClick={() => setRetry((n) => n + 1)}
          >
            Couldn’t load comment. Tap to retry.
          </button>
        ) : !item ? (
          item === null ? (
            <div className="comment-tombstone">Comment unavailable</div>
          ) : (
            <div className="comment-placeholder">
              <span />
              <span />
            </div>
          )
        ) : (
          <>
            <div className="comment-header">
              <div className="comment-author-group">
                {item.by ? (
                  <a
                    className={`comment-author username-link ${item.by === author ? "op-author" : ""}`}
                    href={userPath(item.by)}
                  >
                    {item.by}
                  </a>
                ) : (
                  <span className="comment-author">[deleted]</span>
                )}
                {item.by === author && <span className="op-badge">OP</span>}
                {collapsed && (
                  <span className="collapsed-count">
                    {children.length
                      ? `${children.length} ${children.length === 1 ? "reply" : "replies"}`
                      : "collapsed"}
                  </span>
                )}
              </div>
              <button
                className="comment-collapse icon-button"
                onClick={() => setCollapsed((value) => !value)}
                aria-expanded={!collapsed}
                aria-label={`${collapsed ? "Expand" : "Collapse"} comment by ${item.by ?? "deleted"}`}
              >
                {collapsed ? (
                  <ChevronRight size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
              </button>
              <button
                className="comment-menu icon-button"
                onClick={() => onActions(item)}
                aria-label={`Actions for comment by ${item.by ?? "deleted"}`}
              >
                <MoreHorizontal size={20} />
              </button>
              <span className="comment-time">{timeAgo(item.time)}</span>
            </div>
            {!collapsed && (
              <div className="comment-body">
                {item.deleted || item.dead ? (
                  <span className="comment-tombstone">
                    {item.deleted ? "[deleted]" : "[unavailable]"}
                  </span>
                ) : (
                  <RichText html={item.text ?? ""} />
                )}
              </div>
            )}
          </>
        )}
      </div>
      {item && !collapsed && (
        <div className="comment-children">
          {children.slice(0, limit).map((child) => (
            <Comment
              key={child}
              id={child}
              storyId={storyId}
              depth={depth + 1}
              author={author}
              visit={visit}
              readAtOpen={readAtOpen}
              onActions={onActions}
              forceRefresh={forceRefresh}
            />
          ))}
          {children.length > limit && (
            <div
              className="comment-row reply-row"
              data-depth={depth + 1}
              style={
                {
                  ...style,
                  "--depth": Math.min(depth + 1, 7),
                  "--thread-color": [
                    "#ed2525",
                    "#f28b16",
                    "#e3b728",
                    "#20a75a",
                    "#1683f8",
                    "#a554ce",
                  ][depth % 6],
                } as CSSProperties
              }
            >
              <button
                className="more-replies"
                onClick={() => setLimit((value) => value + 12)}
              >
                {children.length - limit} more{" "}
                {children.length - limit === 1 ? "reply" : "replies"}
                <ChevronDown size={18} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export function ThreadView({
  id,
  newest,
  refresh,
  onActions,
  onLoaded,
  onShare,
  onRefreshComplete,
}: {
  id: number;
  newest: boolean;
  refresh: number;
  onActions: (item: HNItem) => void;
  onLoaded: (item: HNItem, newCount: number) => void;
  onShare: (item: HNItem) => void;
  onRefreshComplete: () => void;
}) {
  const { scrollRef } = useScrollSurface();
  const [item, setItem] = useState<HNItem | null | undefined>(() =>
    peekItem(id),
  );
  const [visit, setVisit] = useState<DiscussionVisit>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [limit, setLimit] = useState(20);
  const [query, setQuery] = useState("");
  const readAtOpen = useRef(
    new Set(Object.keys(reader.get().comments).map(Number)),
  );
  useEffect(() => {
    let cancelled = false;
    setError(false);
    // Always revalidate the discussion count so the New badge is based on the
    // latest HN response, rather than a previously cached feed item.
    getItem(id, true)
      .then((value) => {
        if (cancelled) return;
        setItem(value);
        if (value && !value.deleted && !value.dead) {
          const nextVisit = reader.openDiscussion(value);
          setVisit(nextVisit);
          onLoaded(value, nextVisit.unread);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) onRefreshComplete();
      });
    return () => {
      cancelled = true;
    };
  }, [id, refresh, retry, onLoaded, onRefreshComplete]);
  if (error)
    return (
      <ErrorState
        onRetry={() => setRetry((n) => n + 1)}
        message="Couldn’t load this discussion."
      />
    );
  if (item === undefined) return <Loading label="Loading discussion…" />;
  if (item === null || item.deleted || item.dead)
    return (
      <Empty
        icon={<MessageCircle size={40} strokeWidth={1.2} />}
        title="This story is unavailable"
      >
        It may have been removed from Hacker News.
      </Empty>
    );
  const ids = newest
    ? [...(item.kids ?? [])].sort((a, b) => b - a)
    : (item.kids ?? []);
  function nextThread() {
    const root = scrollRef.current;
    if (!root) return;
    const top =
      root.closest(".app-shell")
        ?.querySelector(".navigation-bar")
        ?.getBoundingClientRect().bottom ?? root.getBoundingClientRect().top;
    const next = [...root.querySelectorAll<HTMLElement>(".root-comment")].find(
      (node) => node.getBoundingClientRect().top > top + 35,
    );
    if (next)
      next.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    else if (limit < ids.length) setLimit((value) => value + 20);
  }
  return (
    <>
      <div className="comment-search">
        <label className="search-field">
          <Search size={18} />
          <input
            type="search"
            placeholder="Find in Comments"
            aria-label="Find in Comments"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              aria-label="Clear comment search"
              onClick={() => setQuery("")}
            >
              <X size={14} />
            </button>
          )}
        </label>
      </div>
      {query.trim() ? (
        <CommentSearch
          key={`${id}-${query.trim()}`}
          query={query.trim()}
          story={id}
          visit={visit}
          readAtOpen={readAtOpen.current}
          clear={() => setQuery("")}
        />
      ) : (
        <>
          <Post item={item} onActions={onActions} onShare={onShare} detail />
          {visit ? (
            <section className="comments" aria-label="Comments">
              {ids.slice(0, limit).map((child) => (
                <Comment
                  key={child}
                  id={child}
                  storyId={id}
                  author={item.by}
                  visit={visit}
                  readAtOpen={readAtOpen.current}
                  onActions={onActions}
                  forceRefresh={refresh > 0}
                />
              ))}
            </section>
          ) : (
            <Loading label="Loading comments…" />
          )}
          {limit < ids.length && (
            <button
              className="load-more"
              onClick={() => setLimit((value) => value + 20)}
            >
              Load more comments
            </button>
          )}
          {!ids.length && (
            <Empty
              icon={<MessageCircle size={38} strokeWidth={1.1} />}
              title="It’s quiet in here"
            >
              {item.type === "job"
                ? "Hacker News job listings don’t have comments."
                : "No comments yet. Come back in a little while."}
            </Empty>
          )}
          {!!ids.length && (
            <button
              className="jump-button"
              onClick={nextThread}
              aria-label="Jump to next top-level comment"
            >
              <JumpIcon size={24} />
            </button>
          )}
        </>
      )}
    </>
  );
}
