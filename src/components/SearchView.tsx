import { useCallback, useEffect, useRef, useState } from "react";
import { History, Search, X } from "lucide-react";
import type { HNItem } from "../types";
import { searchStories } from "../api";
import { reader, useReader } from "../store";
import { Post } from "./Post";
import { Empty, ErrorState, Loading } from "./Common";
import { useScrollSurface } from "./ScrollSurface";
let previous = {
  query: "",
  newest: false,
  items: [] as HNItem[],
  page: 0,
  pages: 0,
};
export function SearchView({
  onActions,
}: {
  onActions: (item: HNItem) => void;
}) {
  const { active } = useScrollSurface();
  const { searches } = useReader();
  const [query, setQuery] = useState(previous.query);
  const [newest, setNewest] = useState(previous.newest);
  const [results, setResults] = useState(previous.items);
  const [page, setPage] = useState(previous.page);
  const [pages, setPages] = useState(previous.pages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const draft = useRef({ query: previous.query, candidate: "" });
  const finishSearch = useCallback((value = draft.current.candidate) => {
    if (value.trim()) reader.rememberSearch(value);
    draft.current.candidate = "";
  }, []);
  useEffect(() => {
    if (!active) finishSearch();
  }, [active, finishSearch]);
  function changeQuery(value: string) {
    const next = value.trim();
    if (!next) finishSearch();
    // Deleting a query should retain the complete term, not its last fragment.
    else if (!draft.current.query.trim().startsWith(next))
      draft.current.candidate = next;
    draft.current.query = value;
    setQuery(value);
  }
  useEffect(() => {
    const save = () => finishSearch();
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [finishSearch]);
  useEffect(() => {
    const currentId = ++requestId.current;
    const controller = new AbortController();
    const searchQuery = query.trim();
    if (!searchQuery) {
      setResults([]);
      setError(false);
      setLoading(false);
      previous = { query: "", newest, items: [], page: 0, pages: 0 };
      return;
    }
    if (
      query === previous.query &&
      newest === previous.newest &&
      !retry &&
      previous.items.length
    ) {
      setResults(previous.items);
      setPage(previous.page);
      setPages(previous.pages);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    const timer = setTimeout(() => {
      searchStories(searchQuery, 0, newest, controller.signal)
        .then((result) => {
          if (controller.signal.aborted || currentId !== requestId.current)
            return;
          setResults(result.items);
          setPage(0);
          setPages(result.pages);
          previous = {
            query,
            newest,
            items: result.items,
            page: 0,
            pages: result.pages,
          };
        })
        .catch(() => {
          if (!controller.signal.aborted) setError(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, newest, retry]);
  async function more() {
    const currentId = requestId.current;
    setLoading(true);
    setError(false);
    try {
      const result = await searchStories(query.trim(), page + 1, newest);
      if (currentId !== requestId.current) return;
      setResults((items) => [...items, ...result.items]);
      setPage(page + 1);
      previous = {
        query,
        newest,
        items: [...results, ...result.items],
        page: page + 1,
        pages: result.pages,
      };
    } catch {
      if (currentId === requestId.current) setError(true);
    } finally {
      if (currentId === requestId.current) setLoading(false);
    }
  }
  return (
    <>
      <div className="search-controls">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            finishSearch(query);
            input.current?.blur();
          }}
          role="search"
        >
          <label className="search-field">
            <Search size={18} />
            <input
              ref={input}
              type="search"
              value={query}
              onChange={(event) => changeQuery(event.target.value)}
              onBlur={() => finishSearch()}
              placeholder="Search Posts"
              aria-label="Search Posts"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  changeQuery("");
                  input.current?.focus();
                }}
              >
                <X size={14} />
              </button>
            )}
          </label>
        </form>
        {query.trim() && (
          <div className="segmented-control" aria-label="Sort search results">
            <button
              aria-pressed={!newest}
              className={!newest ? "selected" : ""}
              onClick={() => setNewest(false)}
            >
              Most relevant
            </button>
            <button
              aria-pressed={newest}
              className={newest ? "selected" : ""}
              onClick={() => setNewest(true)}
            >
              Newest
            </button>
          </div>
        )}
      </div>
      {!query.trim() ? (
        searches.length > 0 && (
          <div
            className="search-history"
            role="region"
            aria-label="Search history"
          >
            {searches.map((value) => (
              <div className="search-history-row" key={value}>
                <button
                  className="search-history-query"
                  onClick={() => {
                    changeQuery(value);
                    finishSearch(value);
                  }}
                  aria-label={`Search again for ${value}`}
                >
                  <History size={17} />
                  <span>{value}</span>
                </button>
                <button
                  className="search-history-remove icon-button"
                  onClick={() => reader.removeSearch(value)}
                  aria-label={`Remove ${value} from search history`}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          {!loading && !error && results.length === 0 && (
            <Empty
              icon={<Search size={40} strokeWidth={1.2} />}
              title="No stories found"
            >
              Try a different word or a broader search.
            </Empty>
          )}
          {results.map((item) => (
            <Post key={item.id} item={item} onActions={onActions} />
          ))}
          {loading && <Loading label="Searching Hacker News…" />}
          {error && (
            <ErrorState
              message="Search is unavailable right now."
              onRetry={() => setRetry((n) => n + 1)}
            />
          )}
          {!loading && !error && page + 1 < pages && (
            <button className="load-more" onClick={more}>
              Load more results
            </button>
          )}
          <div className="feed-footnote">Search powered by Algolia</div>
        </>
      )}
    </>
  );
}
