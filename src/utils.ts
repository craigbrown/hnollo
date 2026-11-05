import DOMPurify from "dompurify";
export function timeAgo(time?: number) {
  if (!time) return "now";
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - time));
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  if (seconds < 31536000) return `${Math.floor(seconds / 604800)}w`;
  return `${Math.floor(seconds / 31536000)}y`;
}
export function number(value: number | null | undefined = 0) {
  value = value ?? 0;
  return value >= 10000
    ? `${(value / 1000).toFixed(1).replace(".0", "")}K`
    : value.toLocaleString();
}
export function safeUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
// The in-app route for a link to a Hacker News post, comment or user, if it is one.
export function hnPath(value?: string) {
  try {
    const url = new URL(value ?? "");
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !/^(?:www\.)?news\.ycombinator\.com$/i.test(url.hostname)
    ) return undefined;
    if (url.pathname === "/user") {
      const name = url.searchParams.get("id") ?? "";
      return name && name.length <= 80 ? userPath(name) : undefined;
    }
    if (url.pathname !== "/item") return undefined;
    const id = url.searchParams.get("id") ?? "";
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0)
      return undefined;
    // HN also links to a comment within its discussion as item?id=story#comment.
    const comment = url.hash.slice(1);
    return /^\d+$/.test(comment) && Number.isSafeInteger(Number(comment)) &&
      Number(comment) > 0 && comment !== id
      ? `#/item/${id}/comment/${comment}`
      : `#/item/${id}`;
  } catch {
    return undefined;
  }
}
export function domain(value?: string) {
  try {
    return new URL(value ?? "").hostname.replace(/^www\./, "");
  } catch {
    return "news.ycombinator.com";
  }
}
export function decode(value = "") {
  const doc = new DOMParser().parseFromString(value, "text/html");
  return doc.documentElement.textContent ?? "";
}
export function sanitize(value: string) {
  const clean = DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [
      "p",
      "a",
      "i",
      "em",
      "b",
      "strong",
      "code",
      "pre",
      "blockquote",
      "s",
      "ul",
      "ol",
      "li",
      "br",
    ],
    ALLOWED_ATTR: ["href", "title"],
  });
  const doc = new DOMParser().parseFromString(clean, "text/html");
  doc.querySelectorAll("a").forEach((anchor) => {
    const url = safeUrl(anchor.getAttribute("href") ?? undefined);
    const path = hnPath(url);
    if (!url) anchor.removeAttribute("href");
    else if (path) anchor.setAttribute("href", path);
    else {
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }
  });
  return doc.body.innerHTML;
}
export const itemUrl = (id: number) =>
  `https://news.ycombinator.com/item?id=${id}`;

function appUrl(path: string) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = path;
  return url.href;
}

export function appPostUrl(id: number, commentId?: number) {
  return appUrl(`/item/${id}${commentId ? `/comment/${commentId}` : ""}`);
}

export const userPath = (name: string) => `#/user/${encodeURIComponent(name)}`;
export const appUserUrl = (name: string) => appUrl(userPath(name));
export const userUrl = (name: string) =>
  `https://news.ycombinator.com/user?id=${encodeURIComponent(name)}`;
export function accountAge(created: number) {
  const then = new Date(created * 1000);
  const now = new Date();
  let months =
    (now.getUTCFullYear() - then.getUTCFullYear()) * 12 +
    now.getUTCMonth() -
    then.getUTCMonth();
  if (now.getUTCDate() < then.getUTCDate()) months--;
  months = Math.max(0, months);
  const years = Math.floor(months / 12);
  if (years) return `${years}y${months % 12 ? ` ${months % 12}mo` : ""}`;
  if (months) return `${months}mo`;
  const days = Math.max(
    0,
    Math.floor((now.getTime() - then.getTime()) / 86400000),
  );
  return days ? `${days}d` : "Today";
}
