import { safeUrl } from "./utils";

export interface LinkPreview {
  image?: string;
  title?: string;
  description?: string;
}
interface CachedPreview {
  url: string;
  expires: number;
  data: LinkPreview;
}
const STORAGE_KEY = "hnollo:previews:v1";
const cache = new Map<string, CachedPreview>();
const pending = new Map<string, Promise<LinkPreview>>();
const queue: (() => void)[] = [];
let active = 0;
let hydrated = false;
const LIMIT = 150;

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const entries: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    if (!Array.isArray(entries)) return;
    for (const entry of entries.slice(-LIMIT)) {
      if (
        !entry ||
        typeof entry.url !== "string" ||
        typeof entry.expires !== "number" ||
        entry.expires < Date.now() ||
        !entry.data ||
        typeof entry.data !== "object"
      )
        continue;
      cache.set(entry.url, {
        url: entry.url,
        expires: entry.expires,
        data: {
          image: safeUrl(entry.data.image),
          title:
            typeof entry.data.title === "string"
              ? entry.data.title.slice(0, 500)
              : undefined,
          description:
            typeof entry.data.description === "string"
              ? entry.data.description.slice(0, 1000)
              : undefined,
        },
      });
    }
  } catch {
    /* Storage is optional, just as it is for reading history. */
  }
}
function remember(url: string, data: LinkPreview, successful: boolean) {
  cache.delete(url);
  cache.set(url, {
    url,
    data,
    expires: Date.now() + (successful ? 86400000 : 600000),
  });
  while (cache.size > LIMIT) cache.delete(cache.keys().next().value!);
  if (successful) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          [...cache.values()].filter(
            (entry) =>
              entry.data.image || entry.data.title || entry.data.description,
          ),
        ),
      );
    } catch {
      /* Keep working with the memory cache when storage is full. */
    }
  }
}

export function parsePreview(html: string, pageUrl: string): LinkPreview {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tags = new Map<string, string[]>();
  doc.querySelectorAll("meta").forEach((meta) => {
    const key = (
      meta.getAttribute("property") ??
      meta.getAttribute("name") ??
      ""
    )
      .toLowerCase()
      .trim();
    const value = meta.getAttribute("content")?.trim();
    if (value) tags.set(key, [...(tags.get(key) ?? []), value]);
  });
  let base = pageUrl;
  try {
    base = new URL(
      doc.querySelector("base[href]")?.getAttribute("href") ?? pageUrl,
      pageUrl,
    ).href;
  } catch {
    /* Use the final response URL. */
  }
  const images = [
    "og:image:secure_url",
    "og:image",
    "og:image:url",
    "twitter:image",
    "twitter:image:src",
  ].flatMap((key) => tags.get(key) ?? []);
  const image = images.flatMap((candidate) => {
    try {
      const url = safeUrl(new URL(candidate, base).href);
      return url ? [url] : [];
    } catch {
      return [];
    }
  })[0];
  const title = (
    tags.get("og:title")?.[0] ?? tags.get("twitter:title")?.[0]
  )?.slice(0, 500);
  const description = (
    tags.get("og:description")?.[0] ??
    tags.get("twitter:description")?.[0] ??
    tags.get("description")?.[0]
  )?.slice(0, 1000);
  return { image, title, description };
}

async function readHead(response: Response): Promise<string> {
  if (!response.body) return (await response.text()).slice(0, 262144);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;
  try {
    while (bytes < 262144 && !/<\/head\s*>/i.test(html)) {
      const chunk = await reader.read();
      if (chunk.done) break;
      const part = chunk.value.subarray(0, 262144 - bytes);
      bytes += part.byteLength;
      html += decoder.decode(part, { stream: true });
    }
    return html + decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
  }
}

async function discover(url: string): Promise<LinkPreview> {
  if (active >= 3) await new Promise<void>((resolve) => queue.push(resolve));
  active++;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, {
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (
      !response.ok ||
      !/text\/html|application\/xhtml\+xml/i.test(
        response.headers.get("content-type") ?? "",
      )
    )
      throw new Error("No readable HTML metadata");
    const data = parsePreview(await readHead(response), response.url || url);
    remember(url, data, true);
    return data;
  } catch {
    remember(url, {}, false);
    return {};
  } finally {
    clearTimeout(timeout);
    active--;
    queue.shift()?.();
  }
}
export function cachedPreview(url: string): LinkPreview | undefined {
  hydrate();
  const entry = cache.get(url);
  return entry && entry.expires > Date.now() ? entry.data : undefined;
}
export function getLinkPreview(url: string): Promise<LinkPreview> {
  const cached = cachedPreview(url);
  if (cached) return Promise.resolve(cached);
  const existing = pending.get(url);
  if (existing) return existing;
  const request = discover(url).finally(() => pending.delete(url));
  pending.set(url, request);
  return request;
}
