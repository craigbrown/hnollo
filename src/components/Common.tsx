import { useEffect, useId, useLayoutEffect, useRef } from "react";
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
  description,
  children,
  close,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    headingRef.current?.focus({ preventScroll: true });
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="action-sheet"
      aria-label={title}
      aria-describedby={description ? descriptionId : undefined}
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
        <div className="sheet-heading" ref={headingRef} tabIndex={-1}>
          {title}
          {description && (
            <p id={descriptionId} className="sheet-description">
              {description}
            </p>
          )}
        </div>
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
  anchor,
  hideTitle = false,
  className = "",
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  anchor?: HTMLElement | null;
  hideTitle?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    headingRef.current?.focus({ preventScroll: true });
    function position() {
      if (!anchor) return;
      const margin = 12;
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const right = left + (viewport?.width ?? window.innerWidth);
      const bottom = top + (viewport?.height ?? window.innerHeight);
      dialog.style.maxHeight = `${Math.max(0, bottom - top - margin * 2)}px`;
      dialog.style.maxWidth = `${Math.max(0, right - left - margin * 2)}px`;
      const trigger = anchor.getBoundingClientRect();
      const menu = dialog.getBoundingClientRect();
      const below = trigger.bottom + 6;
      const above = trigger.top - menu.height - 6;
      const y = below + menu.height <= bottom - margin ? below : above;
      const x = Math.max(left + margin,
        Math.min(trigger.right - menu.width, right - menu.width - margin));
      dialog.style.left = `${x}px`;
      dialog.style.top = `${Math.max(top + margin,
        Math.min(y, bottom - menu.height - margin))}px`;
      dialog.style.right = "auto";
    }
    position();
    window.addEventListener("resize", position);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    return () => {
      window.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
      dialog.close();
    };
  }, [anchor]);
  return (
    <dialog
      ref={ref}
      className={`sort-popover ${className}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className={`popover-heading ${hideTitle ? "sr-only" : "sort-popover-title"}`}
        ref={headingRef}
        tabIndex={-1}
      >
        {title}
      </div>
      <div className="sort-popover-options">{children}</div>
    </dialog>
  );
}
