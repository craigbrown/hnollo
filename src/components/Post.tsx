import {
  ArrowUp,
  Bookmark,
  Clock3,
  FileText,
  Link2,
  MessageCircle,
  MoreHorizontal,
  ExternalLink,
  Share,
  Globe,
} from "lucide-react";
import type { HNItem, ItemActionHandler } from "../types";
import { decode, domain, number, safeUrl, timeAgo, userPath } from "../utils";
import { newCommentCount, reader, useReader } from "../store";
import { RichText } from "./Common";
import { peekItem } from "../api";
import { LinkCard } from "./LinkCard";

export function Post({
  item,
  onActions,
  onShare,
  detail = false,
}: {
  item: HNItem;
  onActions: ItemActionHandler;
  onShare?: (item: HNItem) => void;
  detail?: boolean;
}) {
  const state = useReader();
  item = peekItem(item.id) ?? item;
  const saved = state.saved.some((post) => post.id === item.id);
  const isRead = !!state.posts[item.id];
  const compact = !detail && state.preferences.layout === "compact";
  const newCount = newCommentCount(item, state.discussions[item.id]);
  const url = safeUrl(item.url);
  const title = decode(item.title);
  return (
    <article
      className={`post ${compact ? "compact" : "large"} ${isRead && !detail ? "post-read" : ""} ${detail ? "post-detail" : ""}`}
      data-post-id={item.id}
      data-card-link={!detail || undefined}
    >
      {compact && (
        <a
          className={`post-thumbnail ${url ? "" : "self-post"}`}
          href={`#/item/${item.id}`}
          tabIndex={-1}
          aria-hidden="true"
        >
          {url ? (
            <Link2 size={27} strokeWidth={1.3} />
          ) : (
            <FileText size={30} strokeWidth={1.2} />
          )}
        </a>
      )}
      <div className="post-content">
        <a className="post-title" href={`#/item/${item.id}`}>
          {title}
        </a>
        {!compact && url && <LinkCard key={url} item={item} title={title} />}
        {detail && item.text && (
          <div className="story-text">
            <RichText html={item.text} />
          </div>
        )}
        {!compact && !detail && item.text && (
          <div className="post-text-preview">{decode(item.text)}</div>
        )}
        <div className="post-footer">
          <div className="post-info">
            {!compact && (
              <div className="post-byline">
                by{" "}
                {item.by ? (
                  <a className="username-link" href={userPath(item.by)}>
                    {item.by}
                  </a>
                ) : (
                  <span>anonymous</span>
                )}
              </div>
            )}
            <div className="post-metadata">
              {compact && (
                <span className="compact-domain">
                  {url ? domain(url) : "Hacker News"}
                </span>
              )}
              <span title={`${item.score ?? 0} points`}>
                <ArrowUp size={15} strokeWidth={1.2} />
                {number(item.score)}
              </span>
              <a
                className={`comment-link ${newCount ? "has-new-comments" : ""}`}
                href={`#/item/${item.id}`}
                aria-label={`${number(item.descendants)} comments on ${title}`}
              >
                <span className="comment-bubble">
                  <MessageCircle size={15} strokeWidth={1.3} />
                  {!!newCount && <span className="comment-new-dot" />}
                </span>
                {number(item.descendants)}
              </a>
              {!detail && newCount > 0 && (
                <a
                  className="new-comment-badge"
                  href={`#/item/${item.id}`}
                  aria-label={`${newCount} new ${newCount === 1 ? "comment" : "comments"}`}
                >
                  + {number(newCount)}
                </a>
              )}
              <span
                title={
                  item.time ? new Date(item.time * 1000).toLocaleString() : ""
                }
              >
                <Clock3 size={14} strokeWidth={1.3} />
                {timeAgo(item.time)}
              </span>
              {compact && saved && <Bookmark size={12} fill="currentColor" />}
            </div>
          </div>
          {!detail && (
            <div className="post-actions">
              <button
                className="icon-button more-post"
                onClick={(event) => onActions(item, event.currentTarget)}
                aria-label={`Actions for ${title}`}
              >
                <MoreHorizontal size={24} />
              </button>
            </div>
          )}
        </div>
        {detail && (
          <div className="post-detail-tools">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => reader.markPost(item)}
                aria-label="Read original article"
              >
                <ExternalLink size={24} strokeWidth={1.4} />
              </a>
            )}
            <button
              onClick={() => reader.toggleSaved(item)}
              aria-label={saved ? "Remove bookmark" : "Bookmark discussion"}
            >
              <Bookmark
                size={25}
                strokeWidth={1.4}
                fill={saved ? "currentColor" : "none"}
              />
            </button>
            <a
              href={`https://news.ycombinator.com/item?id=${item.id}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View discussion on Hacker News"
            >
              <Globe size={24} strokeWidth={1.4} />
            </a>
            <button
              onClick={() => onShare?.(item)}
              aria-label="Share discussion"
            >
              <Share size={25} strokeWidth={1.4} />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
