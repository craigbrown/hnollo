export interface HNItem {
  id: number;
  type?: "story" | "comment" | "job" | "poll" | "pollopt";
  by?: string;
  time?: number;
  title?: string;
  text?: string;
  url?: string;
  score?: number;
  descendants?: number;
  kids?: number[];
  parent?: number;
  deleted?: boolean;
  dead?: boolean;
}
export type ItemActionHandler = (item: HNItem, anchor?: HTMLElement) => void;
export type Feed = "top" | "ask" | "show" | "job";
export type StoryOrder = "ranked" | "top" | "new";
export type TopPeriod = "hour" | "day" | "2days" | "week" | "month" | "year" | "all";
export const topPeriods: {
  id: TopPeriod;
  name: string;
  seconds?: number;
  calendar: string;
}[] = [
  { id: "hour", name: "Hour", seconds: 3600, calendar: "60" },
  { id: "day", name: "Day", seconds: 86400, calendar: "1" },
  { id: "2days", name: "2 Days", seconds: 172800, calendar: "2" },
  { id: "week", name: "Week", seconds: 604800, calendar: "7" },
  { id: "month", name: "Month", seconds: 2592000, calendar: "31" },
  { id: "year", name: "Year", seconds: 31536000, calendar: "365" },
  { id: "all", name: "All Time", calendar: "∞" },
];
export const feedPath = (
  feed: Feed,
  order: StoryOrder = "ranked",
  period: TopPeriod = "day",
) =>
  `/feed/${feed}${order === "ranked" ? "" : order === "new" ? "/new" : `/top/${period}`}`;
export const feeds: { id: Feed; name: string; description: string }[] = [
  { id: "top", name: "News", description: "The Hacker News front page" },
  { id: "ask", name: "Ask HN", description: "Questions for the community" },
  { id: "show", name: "Show HN", description: "Things people are making" },
  { id: "job", name: "Jobs", description: "Who’s hiring" },
];

export interface HNUser {
  id: string;
  created: number;
  karma: number;
  about?: string;
  submitted?: number[];
}
export type UserSection = "overview" | "posts" | "comments" | "about";
export interface UserActivity extends HNItem {
  storyId?: number;
  storyTitle?: string;
}
