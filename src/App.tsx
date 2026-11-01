import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  Flame,
  Home,
  Layers,
  Link2,
  MessageCircle,
  MoreHorizontal,
  RefreshCw,
  Search,
  Share,
  Sparkles,
  Trash2,
  TrendingUp,
  Trophy,
} from "lucide-react";
import type { HNItem, Feed, UserSection, StoryOrder, TopPeriod } from "./types";
import { feeds, topPeriods, feedPath } from "./types";
import { peekItem, seedItems } from "./api";
import { reader, useReader } from "./store";
import { decode, itemUrl, number, safeUrl, userUrl } from "./utils";
import { Sheet, PopoverMenu } from "./components/Common";
import { FeedView, LibraryView } from "./components/FeedView";
import { SearchView } from "./components/SearchView";
import { SettingsView } from "./components/SettingsView";
import { PrivacyView } from "./components/PrivacyView";
import { ThreadView } from "./components/ThreadView";
import { PullToRefresh } from "./components/PullToRefresh";
import { UserProfile } from "./components/UserProfile";
import { OverlayScrollbar } from "./components/OverlayScrollbar";
import { ScrollSurface } from "./components/ScrollSurface";
import { navigate as nav, goBack, switchTab, useTabNavigation } from "./navigation";
import type { TabId } from "./navigation";
import {
  CommentSortIcon,
  HistoryIcon,
  PostsIcon,
  SavedIcon,
  SearchIcon,
  SettingsIcon,
} from "./components/Icons";

type Route =
  | { type: "feed"; feed: Feed; order: StoryOrder; period: TopPeriod }
  | { type: "item"; id: number }
  | { type: "user"; name: string; section: UserSection }
  | { type: "feeds" | "saved" | "history" | "search" | "settings" | "privacy" };
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, "").split("/");
  if (path[0] === "settings" && path[1] === "privacy")
    return { type: "privacy" };
  if (
    path[0] === "item" &&
    /^\d+$/.test(path[1] ?? "") &&
    Number.isSafeInteger(Number(path[1])) &&
    Number(path[1]) > 0
  )
    return { type: "item", id: Number(path[1]) };
  if (path[0] === "user" && path[1]) {
    try {
      const name = decodeURIComponent(path[1]);
      if (name.length <= 80)
        return {
          type: "user",
          name,
          section: ["posts", "comments", "about"].includes(path[2])
            ? (path[2] as UserSection)
            : "overview",
        };
    } catch {
      /* Invalid encoded names fall back to Home. */
    }
  }
  if (["saved", "history", "search", "settings", "feeds"].includes(path[0]))
    return {
      type: path[0] as "saved" | "history" | "search" | "settings" | "feeds",
    };
  const feed = feeds.some((option) => option.id === path[1])
    ? (path[1] as Feed)
    : "top";
  const order =
    path[1] === "new"
      ? "new"
      : path[1] === "best"
        ? "top"
        : ["hot", "top", "new"].includes(path[2])
          ? (path[2] as StoryOrder)
          : "hot";
  const period =
    path[1] === "best"
      ? "all"
      : topPeriods.some((option) => option.id === path[3])
        ? (path[3] as TopPeriod)
        : "day";
  return { type: "feed", feed, order, period };
}
const feedIcons = {
  top: Home,
  ask: MessageCircle,
  show: Sparkles,
  job: Layers,
};
const feedColors = {
  top: "pink",
  ask: "green",
  show: "purple",
  job: "slate",
};

export default function App() {
  const { active, tabs } = useTabNavigation();
  const destinations = Object.fromEntries(
    Object.entries(tabs).map(([id, state]) => [id, state.stack.at(-1)!]),
  ) as Record<TabId, string>;
  return (Object.keys(tabs) as TabId[]).map((tab) =>
    tabs[tab].visited && (
      <TabContent
        key={tab}
        tabId={tab}
        hash={tabs[tab].stack.at(-1)!}
        active={active === tab}
        destinations={destinations}
      />
    ),
  );
}

function TabContent({ hash, active, tabId, destinations }: {
  hash: string;
  active: boolean;
  tabId: TabId;
  destinations: Record<TabId, string>;
}) {
  const route = parseRoute(hash);
  const state = useReader();
  const [sheet, setSheet] = useState<
    | "feeds"
    | "more"
    | "sort"
    | "feed-sort"
    | "top-period"
    | "clear"
    | "user"
    | null
  >(null);
  const [actionItem, setActionItem] = useState<HNItem | null>(null);
  const [toast, setToast] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshRequest = useRef<{
    promise: Promise<void>;
    resolve: () => void;
  } | null>(null);
  const finishRefresh = useCallback(() => {
    refreshRequest.current?.resolve();
    refreshRequest.current = null;
    setIsRefreshing(false);
  }, []);
  const triggerRefresh = useCallback((): Promise<void> => {
    if (refreshRequest.current) return refreshRequest.current.promise;
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
      resolve = done;
    });
    refreshRequest.current = { promise, resolve };
    setIsRefreshing(true);
    setRefresh((value) => value + 1);
    return promise;
  }, []);
  const [hideRead, setHideRead] = useState(false);
  const [newest, setNewest] = useState(false);
  const [threadNew, setThreadNew] = useState(0);
  const edgeSwipe = useRef<{ x: number; y: number } | null>(null);
  const [thread, setThread] = useState<HNItem | undefined>(() =>
    route.type === "item" ? peekItem(route.id) : undefined,
  );
  const scrollRef = useRef<HTMLElement>(null);
  const scrollId = `scroll-view-${tabId}`;
  const surface = useMemo(() => ({ scrollRef, active }), [active]);
  const positions = useRef(new Map<string, number>());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const closeSheet = () => {
    setSheet(null);
    setActionItem(null);
  };
  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }, []);
  const onLoaded = useCallback((item: HNItem, newCount: number) => {
    setThread(item);
    setThreadNew(newCount);
  }, []);
  useEffect(() => {
    seedItems([...state.history, ...state.saved]);
    // Seeding is only needed at startup; live items are already cached by the API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    setSheet(null);
    setActionItem(null);
    finishRefresh();
    setRefresh(0);
    setThreadNew(0);
    const nextRoute = parseRoute(hash);
    setThread(nextRoute.type === "item" ? peekItem(nextRoute.id) : undefined);
  }, [hash, finishRefresh]);
  useEffect(() => {
    if (!active) closeSheet();
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function apply() {
      const dark =
        state.preferences.theme === "dark" ||
        (state.preferences.theme === "system" && media.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", dark ? "#202127" : "#f8f8fa");
    }
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [active, state.preferences.theme]);
  useLayoutEffect(() => {
    if (!active) return;
    scrollRef.current?.scrollTo({
      top: positions.current.get(hash) ?? 0,
      behavior: "instant",
    });
  }, [active, hash, thread]);
  useEffect(() => {
    if (!active) return;
    const name =
      route.type === "feed"
        ? feeds.find((feed) => feed.id === route.feed)?.name
        : route.type === "item"
          ? decode(thread?.title) || "Discussion"
          : route.type === "user"
            ? route.name
            : route.type === "feeds"
              ? "Hnollo"
              : route.type[0].toUpperCase() + route.type.slice(1);
    document.title = route.type === "feeds" ? "Hnollo" : `${name} · Hnollo`;
  }, [active, hash, thread?.title]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const activeTab = tabId;
  const feed =
    route.type === "feed"
      ? feeds.find((feed) => feed.id === route.feed)!
      : feeds[0];
  const title =
    route.type === "item"
      ? thread
        ? `${number(thread.descendants)} Comments`
        : "Comments"
      : route.type === "user"
        ? route.name
        : route.type === "feed"
          ? feed.name
          : route.type === "feeds"
            ? "Hnollo"
            : {
                saved: "Saved",
                history: "History",
                search: "Search",
                settings: "Settings",
                privacy: "Privacy",
              }[route.type];
  function refreshPage() {
    closeSheet();
    scrollRef.current?.scrollTo({ top: 0 });
    void triggerRefresh();
  }
  async function share(item: HNItem) {
    closeSheet();
    const url = itemUrl(item.id);
    try {
      if (navigator.share)
        await navigator.share({
          title: decode(item.title) || "Hacker News comment",
          url,
        });
      else {
        await navigator.clipboard.writeText(url);
        notify("Hacker News link copied");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        notify("Couldn’t share this link. Try opening it on Hacker News.");
    }
  }
  async function copyLink(item: HNItem) {
    closeSheet();
    try {
      await navigator.clipboard.writeText(itemUrl(item.id));
      notify("Link copied");
    } catch {
      notify("Couldn’t copy the link in this browser.");
    }
  }
  const content = (
    <div
      hidden={!active}
      onClickCapture={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const anchor = (event.target as Element).closest<HTMLAnchorElement>(
          "a[href]",
        );
        const href = anchor?.getAttribute("href");
        if (
          !href?.startsWith("#/") ||
          anchor?.target === "_blank" ||
          anchor?.closest(".tab-bar")
        ) return;
        event.preventDefault();
        nav(href);
      }}
      className={`app-shell text-${state.preferences.textSize} ${state.preferences.dimRead ? "dim-read" : ""} ${route.type === "privacy" ? "privacy-screen" : ""}`}
    >
      {route.type !== "privacy" && (
        <header className="navigation-bar">
          <div className="nav-left">
            {route.type === "item" || route.type === "user" ? (
              <button
                className="back-button"
                onClick={goBack}
                aria-label={
                  route.type === "item" ? "Back to posts" : "Back"
                }
              >
                <ChevronLeft size={29} strokeWidth={1.8} />
                <span>Back</span>
              </button>
            ) : route.type === "feed" ? (
              <button
                className="back-button"
                aria-label="Back to feeds"
                onClick={() => nav("/feeds")}
              >
                <ChevronLeft size={29} strokeWidth={1.8} />
                <span>Feeds</span>
              </button>
            ) : null}
          </div>
          {route.type === "feed" ? (
            <button
              className="navigation-title"
              onClick={() => setSheet("feeds")}
              aria-label="Choose feed"
            >
              {title}
              <ChevronDown size={14} strokeWidth={2.3} />
            </button>
          ) : (
            <div className="navigation-heading">
              <div className="navigation-title">{title}</div>
              {route.type === "item" && threadNew > 0 && (
                <span className="navigation-subtitle">{threadNew} New</span>
              )}
            </div>
          )}
          <div className="nav-right">
            {route.type === "feed" && (
              <>
                <button
                  className="icon-button nav-icon"
                  onClick={() => setSheet("feed-sort")}
                  aria-label="Sort stories"
                  title={
                    route.order === "top"
                      ? `Top · ${topPeriods.find((option) => option.id === route.period)?.name}`
                      : route.order === "new"
                        ? "New"
                        : "Hot"
                  }
                >
                  {route.order === "top" ? (
                    <Trophy size={25} strokeWidth={1.4} />
                  ) : route.order === "new" ? (
                    <Clock3 size={25} strokeWidth={1.4} />
                  ) : (
                    <Flame size={25} strokeWidth={1.4} />
                  )}
                </button>
                <button
                  className="icon-button nav-icon"
                  onClick={() => setSheet("more")}
                  aria-label="Feed options"
                >
                  <MoreHorizontal size={25} />
                </button>
              </>
            )}
            {route.type === "item" && (
              <>
                <button
                  className="icon-button nav-icon"
                  onClick={() => setSheet("sort")}
                  aria-label="Sort comments"
                >
                  <CommentSortIcon size={27} />
                </button>
                <button
                  className="icon-button nav-icon"
                  onClick={() => thread && setActionItem(thread)}
                  aria-label="Discussion options"
                  disabled={!thread}
                >
                  <MoreHorizontal size={25} />
                </button>
              </>
            )}
            {route.type === "user" && (
              <button
                className="icon-button nav-icon"
                onClick={() => setSheet("user")}
                aria-label="Profile options"
              >
                <MoreHorizontal size={25} />
              </button>
            )}
            {route.type === "history" &&
            (state.history.length > 0 ||
              state.searches.length > 0 ||
              Object.keys(state.posts).length > 0 ||
              Object.keys(state.comments).length > 0 ||
              Object.keys(state.discussions).length > 0) && (
              <button
                className="icon-button nav-icon"
                onClick={() => setSheet("clear")}
                aria-label="Clear reading history"
              >
                <Trash2 size={20} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </header>
      )}
      {hideRead && route.type === "feed" && (
        <button className="filter-banner" onClick={() => setHideRead(false)}>
          <EyeOff size={13} /> Read posts hidden <span>Show all</span>
        </button>
      )}
      <main
        id={scrollId}
        className="scroll-view"
        tabIndex={0}
        ref={scrollRef}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          edgeSwipe.current =
            (route.type === "item" ||
              route.type === "user" ||
              route.type === "privacy") &&
            touch.clientX - event.currentTarget.getBoundingClientRect().left <
              26
              ? { x: touch.clientX, y: touch.clientY }
              : null;
        }}
        onTouchEnd={(event) => {
          const start = edgeSwipe.current;
          edgeSwipe.current = null;
          if (!start) return;
          const touch = event.changedTouches[0];
          if (
            touch.clientX - start.x > 80 &&
            Math.abs(touch.clientY - start.y) < 50
          )
            goBack();
        }}
        onTouchCancel={() => {
          edgeSwipe.current = null;
        }}
        onScroll={() => {
          if (active)
            positions.current.set(hash, scrollRef.current?.scrollTop ?? 0);
        }}
        key={hash}
      >
        <PullToRefresh
          scrollRef={scrollRef}
          routeKey={hash}
          disabled={!["feed", "item", "user"].includes(route.type)}
          refreshing={isRefreshing}
          onRefresh={triggerRefresh}
        />
        {route.type === "feed" && (
          <>
            <div className="feed-search">
              <button className="search-field" onClick={() => nav("/search")}>
                <Search size={18} />
                <span>Search</span>
              </button>
            </div>
            <FeedView
              key={`${route.feed}/${route.order}/${route.period}`}
              feed={route.feed}
              order={route.order}
              period={route.period}
              refresh={refresh}
              hideRead={hideRead}
              onActions={setActionItem}
              onRefreshComplete={finishRefresh}
            />
          </>
        )}
        {route.type === "item" && (
          <ThreadView
            key={`${route.id}-${refresh}`}
            id={route.id}
            newest={newest}
            refresh={refresh}
            onActions={setActionItem}
            onLoaded={onLoaded}
            onShare={share}
            onRefreshComplete={finishRefresh}
          />
        )}
        {route.type === "user" && (
          <UserProfile
            key={`${route.name}/${route.section}`}
            name={route.name}
            section={route.section}
            refresh={refresh}
            onActions={setActionItem}
            onRefreshComplete={finishRefresh}
          />
        )}
        {(route.type === "saved" || route.type === "history") && (
          <LibraryView mode={route.type} onActions={setActionItem} />
        )}
        {route.type === "search" && <SearchView onActions={setActionItem} />}
        {route.type === "settings" && <SettingsView />}
        {route.type === "privacy" && <PrivacyView onDone={goBack} />}
        {route.type === "feeds" && (
          <div className="feeds-page">
            <div className="settings-group">
              {feeds.map((feed) => {
                const Icon = feedIcons[feed.id];
                return (
                  <a
                    href={`#/feed/${feed.id}`}
                    className="feed-row"
                    key={feed.id}
                  >
                    <span className={`feed-icon ${feedColors[feed.id]}`}>
                      <Icon size={24} strokeWidth={1.8} />
                    </span>
                    <div>
                      <span>{feed.name}</span>
                      <small>{feed.description}</small>
                    </div>
                    <ChevronRight size={17} />
                  </a>
                );
              })}
            </div>
            <p className="group-note">
              Hnollo is an unofficial HN client in the style of Apollo
            </p>
          </div>
        )}
      </main>
      <OverlayScrollbar
        scrollRef={scrollRef}
        routeKey={hash}
        scrollId={scrollId}
      />
      {!reader.storageAvailable() && (
        <div className="storage-warning" role="alert">
          Storage is unavailable. Reading history will last for this session.
        </div>
      )}
      {route.type !== "privacy" && (
        <nav className="tab-bar" aria-label="Main navigation">
          {[
            {
              id: "posts",
              name: "Posts",
              icon: PostsIcon,
            },
            { id: "saved", name: "Saved", icon: SavedIcon },
            {
              id: "history",
              name: "History",
              icon: HistoryIcon,
            },
            { id: "search", name: "Search", icon: SearchIcon },
            {
              id: "settings",
              name: "Settings",
              icon: SettingsIcon,
            },
          ].map((tab) => (
            <a
              key={tab.id}
              href={destinations[tab.id as TabId]}
              className={`tab ${activeTab === tab.id ? "active" : ""}`}
              aria-current={activeTab === tab.id ? "page" : undefined}
              onClick={(event) => {
                if (
                  event.button !== 0 ||
                  event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
                ) return;
                event.preventDefault();
                switchTab(tab.id as TabId);
                if (
                  tab.id === activeTab &&
                  route.type !== "item" &&
                  route.type !== "user"
                ) {
                  scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
            >
              <tab.icon size={27} />
              <span>{tab.name}</span>
            </a>
          ))}
        </nav>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {sheet === "feeds" && (
        <Sheet title="Choose a feed" close={closeSheet}>
          {feeds.map((choice) => {
            const Icon = feedIcons[choice.id];
            return (
              <button
                key={choice.id}
                onClick={() => {
                  nav(`/feed/${choice.id}`);
                  closeSheet();
                }}
              >
                <Icon size={21} />
                <span>{choice.name}</span>
                {route.type === "feed" && route.feed === choice.id && (
                  <Check size={20} />
                )}
              </button>
            );
          })}
        </Sheet>
      )}
      {sheet === "more" && (
        <PopoverMenu title={`${feed.name} options`} close={closeSheet}>
          <button onClick={refreshPage}>
            <RefreshCw size={20} />
            <span>Refresh stories</span>
          </button>
          <button
            onClick={() => {
              setHideRead((value) => !value);
              closeSheet();
            }}
          >
            <EyeOff size={20} />
            <span>{hideRead ? "Show All Posts" : "Hide Read Posts"}</span>
            {hideRead && <Check size={19} />}
          </button>
          <button
            onClick={() => {
              reader.setPreferences({
                layout:
                  state.preferences.layout === "large" ? "compact" : "large",
              });
              closeSheet();
            }}
          >
            <Layers size={20} />
            <span>
              {state.preferences.layout === "large"
                ? "Use Compact Posts"
                : "Use Large Posts"}
            </span>
          </button>
        </PopoverMenu>
      )}
      {sheet === "feed-sort" && route.type === "feed" && (
        <PopoverMenu title="Sort by…" close={closeSheet}>
          {(["hot", "top", "new"] as const).map((order) => {
            const Icon =
              order === "hot" ? Flame : order === "top" ? Trophy : Clock3;
            return (
              <button
                key={order}
                aria-pressed={route.order === order}
                onClick={() => {
                  if (order === "top") {
                    setSheet("top-period");
                    return;
                  }
                  nav(feedPath(route.feed, order));
                  closeSheet();
                }}
              >
                <Icon size={23} strokeWidth={1.4} />
                <span>
                  {order === "hot" ? "Hot" : order === "top" ? "Top" : "New"}
                </span>
              </button>
            );
          })}
        </PopoverMenu>
      )}
      {sheet === "top-period" && route.type === "feed" && (
        <PopoverMenu title="Sort by Top for…" close={closeSheet}>
          {topPeriods.map((period) => (
            <button
              key={period.id}
              aria-pressed={route.order === "top" && route.period === period.id}
              onClick={() => {
                nav(feedPath(route.feed, "top", period.id));
                closeSheet();
              }}
            >
              <span className="period-calendar" aria-hidden="true">
                <Calendar size={23} strokeWidth={1.4} />
                <span>{period.calendar}</span>
              </span>
              <span>{period.name}</span>
            </button>
          ))}
        </PopoverMenu>
      )}
      {sheet === "sort" && (
        <Sheet title="Sort comments" close={closeSheet}>
          <button
            onClick={() => {
              setNewest(false);
              closeSheet();
            }}
          >
            <TrendingUp size={20} />
            <span>Top (Hacker News order)</span>
            {!newest && <Check size={19} />}
          </button>
          <button
            onClick={() => {
              setNewest(true);
              closeSheet();
            }}
          >
            <Clock3 size={20} />
            <span>Newest first</span>
            {newest && <Check size={19} />}
          </button>
          <button onClick={refreshPage}>
            <RefreshCw size={20} />
            <span>Refresh discussion</span>
          </button>
        </Sheet>
      )}
      {sheet === "user" && route.type === "user" && (
        <Sheet title={route.name} close={closeSheet}>
          <button onClick={refreshPage}>
            <RefreshCw size={20} />
            <span>Refresh profile</span>
          </button>
          <button
            onClick={async () => {
              closeSheet();
              try {
                await navigator.clipboard.writeText(userUrl(route.name));
                notify("Profile link copied");
              } catch {
                notify("Couldn’t copy the profile link.");
              }
            }}
          >
            <Copy size={20} />
            <span>Copy profile link</span>
          </button>
          <a
            href={userUrl(route.name)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={closeSheet}
          >
            <ArrowUpRight size={20} />
            <span>View on Hacker News</span>
          </a>
        </Sheet>
      )}
      {sheet === "clear" && (
        <Sheet
          title="Clear all reading history on this device?"
          description="This clears read posts, comments, and search history. Saved posts are kept."
          close={closeSheet}
        >
          <button
            className="destructive"
            onClick={() => {
              reader.clearHistory();
              closeSheet();
              notify("Reading history cleared");
            }}
          >
            <Trash2 size={20} />
            <span>Clear all history</span>
          </button>
        </Sheet>
      )}
      {actionItem && (
        <Sheet
          title={
            actionItem.type === "comment"
              ? `Comment by ${actionItem.by ?? "deleted"}`
              : decode(actionItem.title)
          }
          close={closeSheet}
        >
          {actionItem.type !== "comment" && (
            <button
              onClick={() => {
                nav(`/item/${actionItem.id}`);
                closeSheet();
              }}
            >
              <MessageCircle size={20} />
              <span>Open discussion</span>
              <ChevronRight size={17} />
            </button>
          )}
          {actionItem.type !== "comment" && safeUrl(actionItem.url) && (
            <a
              href={safeUrl(actionItem.url)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                reader.markPost(actionItem);
                closeSheet();
              }}
            >
              <ArrowUpRight size={20} />
              <span>Open article</span>
            </a>
          )}
          {actionItem.type !== "comment" && (
            <button
              onClick={() => {
                const saved = state.saved.some(
                  (item) => item.id === actionItem.id,
                );
                reader.toggleSaved(actionItem);
                closeSheet();
                notify(saved ? "Removed from saved posts" : "Saved for later");
              }}
            >
              <Bookmark size={20} />
              <span>
                {state.saved.some((item) => item.id === actionItem.id)
                  ? "Unsave post"
                  : "Save post"}
              </span>
            </button>
          )}
          <button
            onClick={() => {
              if (actionItem.type === "comment")
                reader.markComments([
                  {
                    id: actionItem.id,
                    time: actionItem.time,
                    storyId: route.type === "item" ? route.id : undefined,
                  },
                ]);
              else if (state.posts[actionItem.id])
                reader.markUnread(actionItem.id);
              else reader.markPost(actionItem);
              closeSheet();
            }}
          >
            <Eye size={20} />
            <span>
              {actionItem.type !== "comment" && state.posts[actionItem.id]
                ? "Mark as unread"
                : "Mark as read"}
            </span>
          </button>
          <button onClick={() => share(actionItem)}>
            <Share size={20} />
            <span>Share Hacker News link</span>
          </button>
          <button onClick={() => copyLink(actionItem)}>
            <Copy size={20} />
            <span>Copy link</span>
          </button>
          <a
            href={itemUrl(actionItem.id)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={closeSheet}
          >
            <Link2 size={20} />
            <span>View on Hacker News</span>
            <ArrowUpRight size={17} />
          </a>
        </Sheet>
      )}
    </div>
  );
  return <ScrollSurface.Provider value={surface}>{content}</ScrollSurface.Provider>;
}
