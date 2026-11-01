import { useCallback, useEffect, useRef, useState } from "react";
import { domain, safeUrl } from "../utils";
import type { HNItem } from "../types";
import { reader, useReader } from "../store";
import { cachedPreview, getLinkPreview } from "../previews";
import type { LinkPreview } from "../previews";
import { useScrollSurface } from "./ScrollSurface";
import { tweetId } from "../tweets";
import { TweetEmbed } from "./TweetEmbed";
import { youtubeVideo } from "../youtube";
import { YouTubeEmbed } from "./YouTubeEmbed";

// Known publishers have deterministic image URLs. Other pages are inspected
// for Open Graph/Twitter metadata when their CORS policy permits browser access.
export function previewImage(raw?: string): string | undefined {
  const value = safeUrl(raw);
  if (!value) return;
  const url = new URL(value);
  if (/\.(png|jpe?g|gif|webp|avif)$/i.test(url.pathname)) return url.href;
  const host = url.hostname.replace(/^www\./, "");
  if (host === "github.com") {
    const [owner, repo] = url.pathname.split("/").filter(Boolean);
    if (owner && repo && /^[\w.-]+$/.test(owner) && /^[\w.-]+$/.test(repo))
      return `https://opengraph.githubassets.com/hnollo/${owner}/${repo}`;
  }
  const video = youtubeVideo(url.href);
  if (video) return `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
}
export function LinkCard({ item, title }: { item: HNItem; title: string }) {
  const { twitterDisplay, youtubeDisplay } = useReader().preferences;
  const id = tweetId(item.url);
  const video = youtubeVideo(item.url);
  const [failedTweet, setFailedTweet] = useState<string>();
  const [failedVideo, setFailedVideo] = useState<string>();
  const failEmbed = useCallback(() => setFailedTweet(id), [id]);
  const failVideo = useCallback(() => setFailedVideo(item.url), [item.url]);
  if (youtubeDisplay === "embedded" && video && failedVideo !== item.url)
    return (
      <YouTubeEmbed
        id={video.id}
        start={video.start}
        title={title}
        onFailure={failVideo}
        fallback={<PreviewCard item={item} title={title} discover={false} />}
      />
    );
  if (twitterDisplay === "embedded" && id && failedTweet !== id)
    return (
      <TweetEmbed
        id={id}
        onFailure={failEmbed}
        fallback={<PreviewCard item={item} title={title} discover={false} />}
      />
    );
  return <PreviewCard item={item} title={title} />;
}

function PreviewCard({ item, title, discover = true }: {
  item: HNItem;
  title: string;
  discover?: boolean;
}) {
  const { active } = useScrollSurface();
  const [failed, setFailed] = useState(false);
  const url = safeUrl(item.url);
  const knownImage = previewImage(url);
  const [metadata, setMetadata] = useState<LinkPreview | undefined>(() =>
    url ? cachedPreview(url) : undefined,
  );
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!discover || !active || !url || knownImage || metadata || !ref.current) return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        getLinkPreview(url).then((data) => {
          if (!cancelled) setMetadata(data);
        });
      },
      { root: null, rootMargin: "350px 0px" },
    );
    observer.observe(ref.current);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [discover, active, url, knownImage, metadata]);
  if (!url) return null;
  const image = !failed ? (knownImage ?? metadata?.image) : undefined;
  const directImage = image === url;
  return (
    <a
      ref={ref}
      className={`link-card ${directImage ? "image-post" : ""}`}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => reader.markPost(item)}
      aria-label={`Read article on ${domain(url)}`}
    >
      {image && (
        <div className="link-card-image">
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        </div>
      )}
      {!directImage && (
        <div className="link-card-caption">
          <span className="link-card-publisher">{domain(url)}</span>
          <span className="link-card-title">{metadata?.title || title}</span>
          {metadata?.description && (
            <span className="link-card-description">
              {metadata.description}
            </span>
          )}
        </div>
      )}
    </a>
  );
}
