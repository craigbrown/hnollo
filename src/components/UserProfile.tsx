import { useEffect, useState } from "react";
import {
  ChevronRight,
  FileText,
  Info,
  MessageCircle,
  MoreHorizontal,
  UserRound,
} from "lucide-react";
import type { HNUser, UserActivity, UserSection, ItemActionHandler } from "../types";
import { getUser, getUserActivity, peekUser } from "../api";
import { accountAge, decode, number, timeAgo, userPath } from "../utils";
import { Empty, ErrorState, Loading, RichText } from "./Common";
import { PostsIcon } from "./Icons";
import { Post } from "./Post";

type ActivityPage = { items: UserActivity[]; page: number; pages: number };
const activityCache = new Map<string, ActivityPage>();
export function UserProfile({
  name,
  section,
  refresh,
  onActions,
  onRefreshComplete,
}: {
  name: string;
  section: UserSection;
  refresh: number;
  onActions: ItemActionHandler;
  onRefreshComplete: () => void;
}) {
  const key = `${name}/${section}`;
  const [user, setUser] = useState<HNUser | null | undefined>(() =>
    peekUser(name),
  );
  const [activity, setActivity] = useState<ActivityPage>(
    () => activityCache.get(key) ?? { items: [], page: 0, pages: 0 },
  );
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    setMoreError(false);
    getUser(name, refresh > 0 || retry > 0)
      .then(async (profile) => {
        if (controller.signal.aborted) return;
        setUser(profile);
        if (!profile || section === "about") return;
        const cached = activityCache.get(key);
        if (cached && !refresh && !retry) {
          setActivity(cached);
          return;
        }
        const result = await getUserActivity(
          profile.id,
          section,
          0,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        const next = { items: result.items, pages: result.pages, page: 0 };
        activityCache.set(key, next);
        setActivity(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          onRefreshComplete();
        }
      });
    return () => controller.abort();
  }, [name, section, refresh, retry, key, onRefreshComplete]);
  async function more() {
    if (section === "about" || !user || moreLoading) return;
    setMoreLoading(true);
    setMoreError(false);
    try {
      const result = await getUserActivity(user.id, section, activity.page + 1);
      const next = {
        items: [...activity.items, ...result.items],
        page: activity.page + 1,
        pages: result.pages,
      };
      activityCache.set(key, next);
      setActivity(next);
    } catch {
      setMoreError(true);
    } finally {
      setMoreLoading(false);
    }
  }
  if (loading && !user) return <Loading label="Loading profile…" />;
  if (error)
    return (
      <ErrorState
        message="Couldn’t load this profile."
        onRetry={() => setRetry((value) => value + 1)}
      />
    );
  if (user === null)
    return (
      <Empty
        icon={<UserRound size={40} strokeWidth={1.3} />}
        title="User not found"
      >
        This Hacker News account is unavailable.
      </Empty>
    );
  if (!user) return null;
  return (
    <div className="profile-page">
      {section === "overview" && (
        <>
          {user.about?.trim() && (
            <section
              className="profile-about profile-introduction"
              aria-label={`About ${user.id}`}
            >
              <RichText html={user.about} />
            </section>
          )}
          <div className="profile-stats" aria-label="Account statistics">
            <div>
              <strong>{number(user.karma)}</strong>
              <span>Karma</span>
            </div>
            <div>
              <strong>
                {user.submitted ? number(user.submitted.length) : "—"}
              </strong>
              <span>Contributions</span>
            </div>
            <div>
              <strong>{accountAge(user.created)}</strong>
              <span>
                Account
                <br />
                Age
              </span>
            </div>
          </div>
          <div className="profile-menu">
            <a href={`${userPath(user.id)}/posts`}>
              <PostsIcon size={25} />
              <span>Posts</span>
              <ChevronRight size={18} />
            </a>
            <a href={`${userPath(user.id)}/comments`}>
              <MessageCircle size={24} strokeWidth={1.5} />
              <span>Comments</span>
              <ChevronRight size={18} />
            </a>
            <a href={`${userPath(user.id)}/about`}>
              <Info size={24} strokeWidth={1.5} />
              <span>About</span>
              <ChevronRight size={18} />
            </a>
          </div>
        </>
      )}
      <div className="profile-section-title">
        {section === "overview" ? "OVERVIEW" : section.toUpperCase()}
      </div>
      {section === "about" ? (
        <div className="profile-about">
          {user.about ? (
            <RichText html={user.about} />
          ) : (
            <Empty
              icon={<Info size={32} strokeWidth={1.2} />}
              title="No bio yet"
            >
              {user.id} hasn’t added a public bio.
            </Empty>
          )}
          <div className="profile-joined">
            Joined{" "}
            {new Date(user.created * 1000).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
      ) : (
        <>
          {loading && !activity.items.length ? (
            <Loading label="Loading activity…" />
          ) : (
            <>
              {activity.items.map((item) =>
                item.type === "comment" ? (
                  <ProfileComment
                    key={item.id}
                    item={item}
                    onActions={onActions}
                  />
                ) : (
                  <Post key={item.id} item={item} onActions={onActions} />
                ),
              )}
              {!activity.items.length && (
                <Empty
                  icon={
                    section === "posts" ? (
                      <FileText size={34} strokeWidth={1.2} />
                    ) : (
                      <MessageCircle size={34} strokeWidth={1.2} />
                    )
                  }
                  title="No recent activity"
                >
                  There aren’t any indexed{" "}
                  {section === "overview" ? "posts or comments" : section} to
                  show.
                </Empty>
              )}
              {moreLoading ? (
                <Loading label="Loading activity…" />
              ) : moreError ? (
                <ErrorState
                  message="Couldn’t load more activity."
                  onRetry={more}
                />
              ) : (
                activity.page + 1 < activity.pages && (
                  <button className="load-more" onClick={more}>
                    Load more activity
                  </button>
                )
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
function ProfileComment({
  item,
  onActions,
}: {
  item: UserActivity;
  onActions: ItemActionHandler;
}) {
  return (
    <article className="profile-comment">
      <header>
        <a className="username-link" href={userPath(item.by ?? "")}>
          {item.by}
        </a>
        <button
          className="icon-button"
          aria-label={`Actions for comment by ${item.by}`}
          onClick={(event) => onActions(item, event.currentTarget)}
        >
          <MoreHorizontal size={22} />
        </button>
        <span>{timeAgo(item.time)}</span>
      </header>
      <a
        className="profile-comment-link"
        href={`#/item/${item.storyId ?? item.id}/comment/${item.id}`}
        aria-label={`View comment by ${item.by ?? "anonymous"} in discussion`}
      />
      <div className="profile-comment-body">
        <RichText html={item.text ?? ""} />
      </div>
      {item.storyId && (
        <a className="profile-comment-context" href={`#/item/${item.storyId}`}>
          <span>{decode(item.storyTitle) || "View discussion"}</span>
          <small>HACKER NEWS</small>
        </a>
      )}
    </article>
  );
}
