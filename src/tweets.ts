export interface TweetWidgets {
  createTweet(
    id: string,
    target: HTMLElement,
    options: {
      theme: "light" | "dark";
      dnt: boolean;
      conversation: "none";
      align: "center";
    },
  ): Promise<HTMLElement | null | undefined>;
}

declare global {
  interface Window {
    twttr?: { widgets?: TweetWidgets };
  }
}

export function tweetId(raw?: string) {
  if (!raw) return;
  try {
    const url = new URL(raw);
    if (!/^https?:$/.test(url.protocol) ||
        !/^(?:(?:www|mobile|m)\.)?(?:twitter\.com|x\.com)$/.test(url.hostname))
      return;
    return url.pathname.match(
      /^\/(?:[\w]+\/status(?:es)?|i\/web\/status)\/([1-9]\d{0,19})(?:\/|$)/,
    )?.[1];
  } catch {
    return;
  }
}

// X Articles are often shared as a status containing only a shortened link.
// Its oEmbed HTML exposes that shape, even when the widget omits the article.
// Text and image/video posts still get embeds. Never insert the returned HTML.
export function isLinkOnlyTweetHtml(html: string): boolean {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.querySelector("blockquote.twitter-tweet > p");
  if (!body) return false;
  const links = [...body.querySelectorAll("a")];
  if (!links.length || !links.every((link) => {
    const text = link.textContent?.trim() ?? "";
    return /^https?:\/\/t\.co\/[a-z0-9]+$/i.test(text) ||
      /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/i\/article\/\d+(?:[/?#]|$)/i.test(text);
  })) return false;
  links.forEach((link) => link.remove());
  return !body.textContent?.trim();
}

const linkOnlyRequests = new Map<string, Promise<boolean>>();
let callbackSequence = 0;
export function isLinkOnlyTweet(id: string): Promise<boolean> {
  if (!/^[1-9]\d{0,19}$/.test(id)) return Promise.resolve(false);
  const existing = linkOnlyRequests.get(id);
  if (existing) return existing;
  const request = new Promise<boolean>((resolve) => {
    // oEmbed supports JSONP; ordinary cross-origin fetches are blocked by X.
    const callback = `__hnolloTweet${Date.now()}_${callbackSequence++}`;
    const callbacks = window as unknown as Record<string, unknown>;
    const script = document.createElement("script");
    const url = new URL("https://publish.x.com/oembed");
    url.searchParams.set("url", `https://x.com/i/status/${id}`);
    url.searchParams.set("omit_script", "true");
    url.searchParams.set("dnt", "true");
    url.searchParams.set("callback", callback);
    script.src = url.href;
    script.async = true;
    script.referrerPolicy = "no-referrer";
    const timeout = setTimeout(() => finish(false), 4000);
    let settled = false;
    function finish(linkOnly: boolean) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      script.onerror = null;
      script.onload = null;
      script.remove();
      delete callbacks[callback];
      resolve(linkOnly);
    }
    callbacks[callback] = (data: unknown) => {
      const html = data && typeof data === "object" && "html" in data
        ? data.html : undefined;
      finish(typeof html === "string" && isLinkOnlyTweetHtml(html));
    };
    script.onerror = () => finish(false);
    script.onload = () => finish(false);
    document.head.append(script);
  });
  linkOnlyRequests.set(id, request);
  if (linkOnlyRequests.size > 150)
    linkOnlyRequests.delete(linkOnlyRequests.keys().next().value!);
  return request;
}

let widgetsRequest: Promise<TweetWidgets> | undefined;
export function loadTweetWidgets(): Promise<TweetWidgets> {
  const existing = window.twttr?.widgets;
  if (typeof existing?.createTweet === "function") return Promise.resolve(existing);
  if (widgetsRequest) return widgetsRequest;
  widgetsRequest = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "hnollo-x-widgets";
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.referrerPolicy = "no-referrer";
    const timeout = setTimeout(() => fail(), 8000);
    function cleanup() {
      clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
    }
    function fail() {
      cleanup();
      script.remove();
      reject(new Error("X embeds are unavailable"));
    }
    script.onload = () => {
      const widgets = window.twttr?.widgets;
      if (typeof widgets?.createTweet !== "function") return fail();
      cleanup();
      resolve(widgets);
    };
    script.onerror = fail;
    document.head.append(script);
  });
  return widgetsRequest;
}
