import type { SVGProps } from "react";
type Props = SVGProps<SVGSVGElement> & { size?: number };
function Frame({ size = 26, children, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}
export function PostsIcon(props: Props) {
  return (
    <Frame {...props}>
      <rect x="5.5" y="5.5" width="16" height="20" rx="1.5" />
      <path d="M9 2.5h15v20M9 8.5h9" />
    </Frame>
  );
}
export function SavedIcon(props: Props) {
  return (
    <Frame {...props}>
      <path
        d="M6 3.5h16v22l-8-5.5-8 5.5z"
        fill="currentColor"
        strokeWidth="1.2"
      />
      <path d="M10 8h8M10 11.5h8" stroke="var(--surface)" strokeWidth="1.3" />
    </Frame>
  );
}
export function HistoryIcon(props: Props) {
  return (
    <Frame {...props}>
      <circle cx="14" cy="14" r="11.5" strokeWidth="2.2" />
      <path d="M14 7v7l5 3" strokeWidth="2.2" />
    </Frame>
  );
}
export function SearchIcon(props: Props) {
  return (
    <Frame {...props}>
      <circle cx="11.8" cy="11.8" r="9" strokeWidth="2.4" />
      <path d="m18.5 18.5 7 7" strokeWidth="2.6" />
    </Frame>
  );
}
export function SettingsIcon(props: Props) {
  return (
    <Frame {...props}>
      <path
        d={Array.from({ length: 12 }, (_, i) => {
          const angle = (i * Math.PI) / 6;
          const x = (radius: number) => 14 + Math.sin(angle) * radius;
          const y = (radius: number) => 14 - Math.cos(angle) * radius;
          return `M${x(9)} ${y(9)}L${x(13)} ${y(13)}`;
        }).join("")}
        strokeWidth="2.7"
      />
      <circle cx="14" cy="14" r="9.4" strokeWidth="2.2" />
      <circle cx="14" cy="14" r="5.5" strokeWidth="1.8" />
    </Frame>
  );
}
export function TopSortIcon(props: Props) {
  return (
    <Frame {...props}>
      <path
        d="M2 5h7M2 11h10M2 17h10M2 23h12M20 24V3m-6 6 6-6 6 6"
        strokeWidth="1.4"
      />
    </Frame>
  );
}
export function JumpIcon(props: Props) {
  return (
    <Frame {...props}>
      <path d="m5 10 9 9 9-9" strokeWidth="1.7" />
    </Frame>
  );
}
// GitHub's own mark, from Octicons (mark-github, MIT licence).
export function GitHubIcon({ size = 26, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.37A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  );
}
