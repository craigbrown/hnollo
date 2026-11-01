import { useEffect, useRef, useState } from "react";
import { domain, safeUrl } from "../utils";
import type { HNItem } from "../types";
import { reader } from "../store";
import { cachedPreview, getLinkPreview } from "../previews";
import type { LinkPreview } from "../previews";
import { useScrollSurface } from "./ScrollSurface";

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
  const videoId =
    host === "youtu.be"
      ? url.pathname.slice(1)
      : ["youtube.com", "m.youtube.com"].includes(host)
        ? (url.searchParams.get("v") ??
          url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1])
        : undefined;
  if (videoId && /^[\w-]{11}$/.test(videoId))
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
export function LinkCard({ item, title }: { item: HNItem; title: string }) {
  const { active } = useScrollSurface();
  const [failed, setFailed] = useState(false);
  const url = safeUrl(item.url);
  const knownImage = previewImage(url);
  const [metadata, setMetadata] = useState<LinkPreview | undefined>(() =>
    url ? cachedPreview(url) : undefined,
  );
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!active || !url || knownImage || metadata || !ref.current) return;
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
  }, [active, url, knownImage, metadata]);
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
