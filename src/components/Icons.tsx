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
export function CommentSortIcon(props: Props) {
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
