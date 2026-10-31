import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { sanitize } from "../utils";
export function RichText({
  html,
  className = "",
}: {
  html: string;
  className?: string;
}) {
  return (
    <div
      className={`rich-text ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitize(html) }}
    />
  );
}
export function Loading({ label = "Loading stories…" }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      {label}
    </div>
  );
}
export function Skeletons() {
  return (
    <div aria-label="Loading stories" role="status" className="skeleton-list">
      {Array.from({ length: 6 }, (_, i) => (
        <div className="skeleton-post" key={i}>
          <div />
          <div />
          <div />
        </div>
      ))}
    </div>
  );
}
export function ErrorState({
  onRetry,
  message = "Couldn’t connect to Hacker News.",
}: {
  onRetry: () => void;
  message?: string;
}) {
  return (
    <div className="empty-state error-state">
      <AlertCircle size={34} strokeWidth={1.3} />
      <h2>{message}</h2>
      <p>Check your connection and give it another try.</p>
      <button className="text-button" onClick={onRetry}>
        <RefreshCw size={16} /> Try again
      </button>
    </div>
  );
}
export function Empty({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon}
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
export function Sheet({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="action-sheet"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="sheet-surface">
        <div className="sheet-handle" />
        <div className="sheet-heading">{title}</div>
        <div className="sheet-options">{children}</div>
        <button className="sheet-cancel" onClick={close}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}

export function PopoverMenu({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="sort-popover"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="sort-popover-title">{title}</div>
      <div className="sort-popover-options">{children}</div>
    </dialog>
  );
}
