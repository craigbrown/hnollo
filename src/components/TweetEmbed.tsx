import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { isLinkOnlyTweet, loadTweetWidgets } from "../tweets";
import { useScrollSurface } from "./ScrollSurface";

const currentTheme = () => document.documentElement.dataset.theme === "dark"
  ? "dark" as const : "light" as const;

export function TweetEmbed({ id, fallback, onFailure }: {
  id: string;
  fallback: ReactNode;
  onFailure: () => void;
}) {
  const { active } = useScrollSurface();
  const root = useRef<HTMLDivElement>(null);
  const mount = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState(currentTheme);

  useEffect(() => {
    if (!active) return;
    const update = () => setTheme(currentTheme());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, [active]);

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
    const attempt = document.createElement("div");
    attempt.className = "tweet-embed-attempt";
    mount.current.replaceChildren(attempt);
    setReady(false);
    function fail() {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(timeout);
      attempt.remove();
      onFailure();
    }
    const timeout = setTimeout(fail, 12000);
    isLinkOnlyTweet(id)
      .then(async (linkOnly) => {
        if (cancelled) return;
        if (linkOnly) {
          fail();
          return;
        }
        const widgets = await loadTweetWidgets();
        if (cancelled) return;
        return widgets.createTweet(id, attempt, {
          theme, dnt: true, conversation: "none", align: "center",
        });
      })
      .then((widget) => {
        if (cancelled) return;
        if (!widget || !attempt.contains(widget)) return fail();
        clearTimeout(timeout);
        setReady(true);
      })
      .catch(fail);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      attempt.remove();
    };
  }, [id, theme, visible, onFailure]);

  return (
    <div ref={root} className="tweet-embed" role="region" aria-label="Post on X">
      <div
        ref={mount}
        className="tweet-embed-stage"
        aria-hidden={!ready}
        inert={!ready}
      />
      {!ready && fallback}
    </div>
  );
}
