import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  MessageCircle,
  MoreHorizontal,
  Search,
  X,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { HNItem, ItemActionHandler } from "../types";
import type { DiscussionVisit } from "../store";
import { getCommentContext, getItem, peekItem } from "../api";
import { reader, useReader, isCommentRead } from "../store";
import { timeAgo, userPath } from "../utils";
import { Post } from "./Post";
import { CommentSearch } from "./CommentSearch";
import { JumpIcon } from "./Icons";
import { Empty, ErrorState, Loading, RichText } from "./Common";
import { useScrollSurface } from "./ScrollSurface";
import { useCommentPosition } from "./useCommentPosition";
import { pageScrollTop, pageViewport, scrollPage } from "../pageScroll";
import { knownThreadCount, loadThreadCount } from "../commentThreads";
import type { ThreadCount } from "../commentThreads";

interface CommentProps {
  id: number;
  storyId: number;
  depth?: number;
  author?: string;
  visit: DiscussionVisit;
  readAtOpen: Set<number>;
  onActions: ItemActionHandler;
  forceRefresh: boolean;
  context?: HNItem[];
  focusedId?: number;
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
  context,
  focusedId,
}: CommentProps) {
  const { active } = useScrollSurface();
  const [item, setItem] = useState<HNItem | null | undefined>(() =>
    context?.[0] ?? peekItem(id),
  );
  const [ready, setReady] = useState(!!context);
  const [failed, setFailed] = useState(false);
  const [contextCollapsed, setContextCollapsed] = useState(false);
  const [limit, setLimit] = useState(6);
  const [retry, setRetry] = useState(0);
  const [threadCount, setThreadCount] = useState<{
    item: HNItem;
    context?: HNItem[];
    total: ThreadCount;
  }>();
  const contentId = useId();
  const container = useRef<HTMLDivElement>(null);
  const state = useReader();
  // A comment permalink must reveal its target and ancestors even if those
  // threads were collapsed in the full discussion. Keep that exception local.
  const collapsed = context ? contextCollapsed : !!state.collapsedComments[id];
  const wasCollapsed = useRef(collapsed);
  function toggleCollapsed() {
    const next = !collapsed;
    reader.setCommentCollapsed(id, next);
    if (context) setContextCollapsed(next);
  }
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
      { root: null, rootMargin: "500px 0px" },
    );
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, [active, ready]);
  useEffect(() => {
    if (!ready || (context && !retry)) return;
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
  }, [id, ready, retry, forceRefresh, context]);
  useEffect(() => {
    if (!active || !collapsed || !item || knownThreadCount(item, context).complete) return;
    const controller = new AbortController();
    loadThreadCount(item, context, controller.signal).then((total) => {
      if (!controller.signal.aborted) setThreadCount({ item, context, total });
    });
    return () => controller.abort();
  }, [active, collapsed, item, context]);
  useLayoutEffect(() => {
    const justCollapsed = collapsed && !wasCollapsed.current;
    wasCollapsed.current = collapsed;
    if (!justCollapsed || !active) return;
    const row = container.current?.querySelector<HTMLElement>(":scope > .comment-row");
    const header = container.current?.closest(".app-shell")?.querySelector(".navigation-bar");
    if (!row || !header) return;
    const top = header.getBoundingClientRect().bottom + 8;
    const rowTop = row.getBoundingClientRect().top;
    // A tap midway through a long comment should leave its collapsed row visible.
    if (rowTop < top) scrollPage(pageScrollTop() + rowTop - top);
  }, [collapsed, active]);
  const knownTotal = collapsed && item ? knownThreadCount(item, context) : undefined;
  const total = knownTotal?.complete
    ? knownTotal
    : collapsed && item && threadCount?.item === item && threadCount.context === context
      ? threadCount.total
      : knownTotal;
  // Keep ancestors together in a permalink view, without intervening siblings
  // displacing the parent context. The selected comment's replies remain normal.
  const contextChild = context?.[1];
  const childContext = useMemo(() => context?.slice(1), [context]);
  const children = contextChild ? [contextChild.id] : item?.kids ?? [];
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
        className={`comment-row ${isNew ? "comment-new" : ""} ${collapsed ? "comment-collapsed" : ""} ${id === focusedId ? "comment-focused" : ""}`}
        style={style}
        data-depth={depth}
        data-new={isNew || undefined}
        data-comment-toggle={(!!item && !failed) || undefined}
        aria-current={id === focusedId ? "true" : undefined}
        aria-label={isNew ? `New comment by ${item?.by}` : undefined}
        onClick={(event) => {
          if (!item || failed || !(event.target instanceof Element)) return;
          if (event.target.closest("a, button, input, select, textarea, [role='button']")) return;
          // Selecting/copying text must not collapse the comment under the selection.
          if (window.getSelection()?.isCollapsed === false) return;
          toggleCollapsed();
        }}
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
              </div>
              <button
                className={`comment-toggle ${collapsed ? "" : "sr-only"}`}
                onClick={toggleCollapsed}
                aria-expanded={!collapsed}
                aria-controls={`${contentId}-body ${contentId}-children`}
                aria-label={`${collapsed ? "Expand" : "Collapse"} comment by ${item.by ?? "deleted"}${total ? ` (${total.complete ? "" : "at least "}${total.count} ${total.count === 1 ? "comment" : "comments"} collapsed)` : ""}`}
              >
                {collapsed && <span className="collapsed-count" aria-hidden="true">{total?.count}{total?.complete ? "" : "+"}</span>}
                {collapsed && <ChevronDown size={16} aria-hidden="true" />}
              </button>
              {!collapsed && (
                <button
                  className="comment-menu icon-button"
                  onClick={(event) => onActions(item, event.currentTarget)}
                  aria-label={`Actions for comment by ${item.by ?? "deleted"}`}
                >
                  <MoreHorizontal size={20} />
                </button>
              )}
              {!collapsed && <span className="comment-time">{timeAgo(item.time)}</span>}
            </div>
            <div className="comment-body" id={`${contentId}-body`} hidden={collapsed}>
              {item.deleted || item.dead ? (
                <span className="comment-tombstone">
                  {item.deleted ? "[deleted]" : "[unavailable]"}
                </span>
              ) : (
                <RichText html={item.text ?? ""} />
              )}
            </div>
          </>
        )}
      </div>
      {item && (
        <div className="comment-children" id={`${contentId}-children`} hidden={collapsed}>
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
              context={contextChild ? childContext : undefined}
              focusedId={focusedId}
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
  commentId,
  newest,
  refresh,
  onActions,
  onLoaded,
  onShare,
  onRefreshComplete,
}: {
  id: number;
  commentId?: number;
  newest: boolean;
  refresh: number;
  onActions: ItemActionHandler;
  onLoaded: (item: HNItem, newCount: number) => void;
  onShare: (item: HNItem) => void;
  onRefreshComplete: () => void;
}) {
  const { contentRef, preview } = useScrollSurface();
  const [item, setItem] = useState<HNItem | null | undefined>(() => {
    const cached = peekItem(id);
    return cached?.type === "comment" ? undefined : cached;
  });
  // Show the comments from the last visit until this one is recorded, so a
  // returning reader's page is tall enough to restore their scroll position.
  const [visit, setVisit] = useState<DiscussionVisit | undefined>(() =>
    reader.get().discussions[id],
  );
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [limit, setLimit] = useState(20);
  const [query, setQuery] = useState("");
  const [context, setContext] = useState<HNItem[]>();
  // Set when this page's ID turns out to be a comment, e.g. from a link to
  // news.ycombinator.com/item?id=<comment>, which doesn't say which story it's in.
  const [linkedComment, setLinkedComment] = useState<number>();
  const focusedId = commentId ?? linkedComment;
  const discussion = useRef<HTMLDivElement>(null);
  useCommentPosition(focusedId, visit ? context : undefined, query, discussion);
  const readAtOpen = useRef(
    new Set(Object.keys(reader.get().comments).map(Number)),
  );
  useEffect(() => {
    // A preview only shows cached data, and mustn't count as opening the post.
    if (preview) return;
    let cancelled = false;
    setError(false);
    // Always revalidate the discussion count so the New badge is based on the
    // latest HN response, rather than a previously cached feed item.
    async function load() {
      let selected = commentId;
      if (!selected) {
        const value = await getItem(id, true);
        if (value?.type !== "comment") return value;
        // Open a linked comment within its discussion.
        selected = id;
        if (!cancelled) setLinkedComment(id);
      }
      const result = await getCommentContext(selected, refresh > 0 || retry > 0);
      if (id !== selected && result.story.id !== id)
        throw new Error("Comment belongs to a different discussion");
      const story = await getItem(result.story.id, true);
      if (!cancelled) setContext(result.comments);
      return story;
    }
    load()
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
  }, [id, commentId, refresh, retry, onLoaded, onRefreshComplete, preview]);
  if (error)
    return (
      <ErrorState
        onRetry={() => setRetry((n) => n + 1)}
        message={focusedId
          ? "Couldn't load this comment's context."
          : "Couldn't load this discussion."}
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
    const root = contentRef.current;
    if (!root) return;
    const top =
      root.closest(".app-shell")
        ?.querySelector(".navigation-bar")
        ?.getBoundingClientRect().bottom ?? pageViewport().top;
    const next = [...root.querySelectorAll<HTMLElement>(".root-comment")].find(
      (node) => node.getBoundingClientRect().top > top + 35,
    );
    if (next)
      scrollPage(
        pageScrollTop() + next.getBoundingClientRect().top - top - 8,
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      );
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
          story={item.id}
          visit={visit}
          readAtOpen={readAtOpen.current}
          clear={() => setQuery("")}
        />
      ) : (
        <div ref={discussion}>
          <Post item={item} onActions={onActions} onShare={onShare} detail />
          {visit ? (
            <section className="comments" aria-label="Comments">
              {(context ? [context[0].id] : ids.slice(0, limit)).map((child) => (
                <Comment
                  key={child}
                  id={child}
                  storyId={item.id}
                  author={item.by}
                  visit={visit}
                  readAtOpen={readAtOpen.current}
                  onActions={onActions}
                  forceRefresh={refresh > 0}
                  context={context}
                  focusedId={focusedId}
                />
              ))}
            </section>
          ) : (
            <Loading label="Loading comments…" />
          )}
          {context && (
            <a className="load-more" href={`#/item/${item.id}`}>
              View all comments
            </a>
          )}
          {!context && limit < ids.length && (
            <button
              className="load-more"
              onClick={() => setLimit((value) => value + 20)}
            >
              Load more comments
            </button>
          )}
          {!context && !ids.length && (
            <Empty
              icon={<MessageCircle size={38} strokeWidth={1.1} />}
              title="It’s quiet in here"
            >
              {item.type === "job"
                ? "Hacker News job listings don’t have comments."
                : "No comments yet. Come back in a little while."}
            </Empty>
          )}
          {!context && !!ids.length && (
            <button
              className="jump-button"
              onClick={nextThread}
              aria-label="Jump to next top-level comment"
            >
              <JumpIcon size={24} />
            </button>
          )}
        </div>
      )}
    </>
  );
}
