export function youtubeVideo(raw?: string): { id: string; start: number } | undefined {
  if (!raw) return;
  try {
    const url = new URL(raw);
    if (!/^https?:$/.test(url.protocol)) return;
    const host = url.hostname.replace(/^www\./, "");
    const id = host === "youtu.be"
      ? url.pathname.match(/^\/([\w-]+)\/?$/)?.[1]
      : ["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"].includes(host)
        ? (/^\/watch\/?$/.test(url.pathname)
          ? url.searchParams.get("v")
          : url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)\/?$/)?.[1])
        : undefined;
    if (!id || !/^[\w-]{11}$/.test(id)) return;
    const time = url.searchParams.get("start") ?? url.searchParams.get("t") ??
      new URLSearchParams(url.hash.slice(1)).get("t") ?? "0";
    let start = 0;
    if (/^\d+$/.test(time)) start = Number(time);
    else {
      const parts = time.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
      if (parts) start = Number(parts[1] ?? 0) * 3600 +
        Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0);
    }
    return { id, start: Number.isSafeInteger(start) ? start : 0 };
  } catch {
    return;
  }
}

export interface YouTubePlayer {
  pauseVideo(): void;
  destroy(): void;
  getIframe(): HTMLIFrameElement;
}
export interface YouTubeAPI {
  Player: new (target: HTMLElement, options: {
    host: string;
    videoId: string;
    width: string;
    height: string;
    playerVars: { autoplay: 0; playsinline: 1; origin: string; start: number };
    events: {
      onReady: (event: { target: YouTubePlayer }) => void;
      onError: () => void;
    };
  }) => YouTubePlayer;
}
declare global {
  interface Window {
    YT?: YouTubeAPI;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiRequest: Promise<YouTubeAPI> | undefined;
export function loadYouTubeAPI(): Promise<YouTubeAPI> {
  if (typeof window.YT?.Player === "function") return Promise.resolve(window.YT);
  if (apiRequest) return apiRequest;
  apiRequest = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.referrerPolicy = "strict-origin-when-cross-origin";
    const previous = window.onYouTubeIframeAPIReady;
    const timeout = setTimeout(fail, 8000);
    function cleanup() {
      clearTimeout(timeout);
      script.onerror = null;
      if (window.onYouTubeIframeAPIReady === ready)
        window.onYouTubeIframeAPIReady = previous;
    }
    function fail() {
      cleanup();
      script.remove();
      reject(new Error("YouTube embeds are unavailable"));
    }
    function ready() {
      cleanup();
      if (typeof window.YT?.Player === "function") resolve(window.YT);
      else fail();
      previous?.();
    }
    window.onYouTubeIframeAPIReady = ready;
    script.onerror = fail;
    document.head.append(script);
  });
  return apiRequest;
}
