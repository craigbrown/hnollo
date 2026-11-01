import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { loadYouTubeAPI } from "../youtube";
import type { YouTubePlayer } from "../youtube";
import { useScrollSurface } from "./ScrollSurface";

export function YouTubeEmbed({ id, start, title, fallback, onFailure }: {
  id: string;
  start: number;
  title: string;
  fallback: ReactNode;
  onFailure: () => void;
}) {
  const { active } = useScrollSurface();
  const root = useRef<HTMLDivElement>(null);
  const mount = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayer | undefined>(undefined);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active || visible || !root.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { root: null, rootMargin: "350px 0px" });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [active, visible]);

  useEffect(() => {
    if (!visible || !mount.current) return;
    let cancelled = false;
    const target = document.createElement("div");
    mount.current.replaceChildren(target);
    setReady(false);
    function fail() {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(timeout);
      onFailure();
    }
    const timeout = setTimeout(fail, 12000);
    loadYouTubeAPI().then((api) => {
      if (cancelled) return;
      player.current = new api.Player(target, {
        host: "https://www.youtube-nocookie.com",
        videoId: id,
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 0, playsinline: 1, origin: window.location.origin, start },
        events: {
          onReady: ({ target: loaded }) => {
            if (cancelled) return;
            clearTimeout(timeout);
            const iframe = loaded.getIframe();
            iframe.title = `YouTube video: ${title}`;
            iframe.referrerPolicy = "strict-origin-when-cross-origin";
            setReady(true);
          },
          onError: fail,
        },
      });
    }).catch(fail);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      player.current?.destroy();
      player.current = undefined;
      target.remove();
    };
  }, [id, start, title, visible, onFailure]);

  useEffect(() => {
    if (!active && ready) player.current?.pauseVideo();
  }, [active, ready]);

  return (
    <div ref={root} className="youtube-embed" role="region" aria-label="Video on YouTube">
      <div ref={mount} className="youtube-embed-stage" aria-hidden={!ready} inert={!ready} />
      {!ready && fallback}
    </div>
  );
}
