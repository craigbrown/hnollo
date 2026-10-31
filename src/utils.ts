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
    if (!url) anchor.removeAttribute("href");
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

export const userPath = (name: string) => `#/user/${encodeURIComponent(name)}`;
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
