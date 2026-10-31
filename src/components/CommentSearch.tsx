import { useEffect, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import type { HNItem } from "../types";
import { searchComments } from "../api";
import type { DiscussionVisit } from "../store";
import { useReader, isCommentRead } from "../store";
import { itemUrl, timeAgo, userPath } from "../utils";
import { Empty, ErrorState, Loading, RichText } from "./Common";
export function CommentSearch({
  query,
  story,
  visit,
  readAtOpen,
  clear,
}: {
  query: string;
  story: number;
  visit?: DiscussionVisit;
  readAtOpen: Set<number>;
  clear: () => void;
}) {
  const [items, setItems] = useState<HNItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    setItems([]);
    const timer = setTimeout(() => {
      searchComments(query, story, page, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setItems(result.items);
          setPages(result.pages);
          setTotal(result.total);
        })
        .catch(() => {
          if (!controller.signal.aborted) setError(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, story, page, retry]);
  return (
    <div>
      <div className="comment-search-status">
        <span>
          {loading
            ? "Searching this discussion…"
            : `${total} ${total === 1 ? "match" : "matches"} · powered by Algolia`}
        </span>
        <button onClick={clear}>Show discussion</button>
      </div>
      {loading ? (
        <Loading label="Finding comments…" />
      ) : error ? (
        <ErrorState
          message="Couldn’t search this discussion."
          onRetry={() => setRetry((value) => value + 1)}
        />
      ) : !items.length ? (
        <Empty icon={<Search size={34} />} title="No matching comments">
          Try another word. Very recent comments may take a moment to appear in
          search.
        </Empty>
      ) : (
        items.map((item) => (
          <SearchComment
            key={item.id}
            item={item}
            storyId={story}
            visit={visit}
            readAtOpen={readAtOpen}
          />
        ))
      )}
      {!loading && !error && pages > 1 && (
        <div className="search-pagination">
          <button
            disabled={!page}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>
          <span>
            {page + 1} of {pages}
          </span>
          <button
            disabled={page + 1 >= pages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function SearchComment({
  item,
  storyId,
  visit,
  readAtOpen,
}: {
  item: HNItem;
  storyId: number;
  visit?: DiscussionVisit;
  readAtOpen: Set<number>;
}) {
  useReader();
  const read = isCommentRead(item, storyId);
  const isNew =
    !!visit?.unread &&
    !readAtOpen.has(item.id) &&
    (item.time ?? 0) * 1000 > visit.newAfter;
  return (
    <article
      className={`comment-search-result ${read ? "comment-read" : ""} ${isNew ? "comment-new" : ""}`}
    >
      <header>
        {item.by && (
          <a className="username-link" href={userPath(item.by)}>
            {item.by}
          </a>
        )}
        <span>{timeAgo(item.time)}</span>
      </header>
      <div>
        <RichText html={item.text ?? ""} />
      </div>
      <a href={itemUrl(item.id)} target="_blank" rel="noopener noreferrer">
        View comment on Hacker News
        <ArrowUpRight size={13} />
      </a>
    </article>
  );
}
