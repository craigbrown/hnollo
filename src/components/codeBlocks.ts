// Rich text is inserted as an HTML string, so these buttons are part of that
// HTML and keep their state in the DOM rather than in React.

const svg = (body: string) =>
  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const wrapIcon = svg(
  '<path d="M3 6h18M3 12h15a3 3 0 1 1 0 6h-4M3 18h7"/><path d="m16 16-2 2 2 2"/>',
);
const copyIcon = svg(
  '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
);
const checkIcon = svg('<path d="M20 6 9 17l-5-5"/>');
const tools =
  `<button type="button" data-code-action="wrap" aria-pressed="false" aria-label="Wrap lines" title="Wrap lines">${wrapIcon}</button>` +
  `<button type="button" data-code-action="copy" aria-label="Copy code" title="Copy code">${copyIcon}${checkIcon}</button>`;

/** Gives each code block in already sanitized HTML buttons to wrap its lines and copy it. */
export function addCodeTools(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("pre").forEach((pre) => {
    const block = doc.createElement("div");
    block.className = "code-block";
    pre.replaceWith(block);
    block.append(pre);
    const toolbar = doc.createElement("div");
    toolbar.className = "code-tools";
    toolbar.innerHTML = tools;
    block.append(toolbar);
  });
  return doc.body.innerHTML;
}

const touchOnly = window.matchMedia("(hover: none)");

/**
 * Acts on a click on a code block button. On touch screens, where the buttons
 * can't wait for a hover, a tap elsewhere in the block hides or shows them.
 * Any other click is ignored. Returns whether the click was handled, so it
 * can be kept from also acting on what the code block sits in.
 */
export function handleCodeBlockClick(target: EventTarget) {
  if (!(target instanceof Element)) return false;
  const block = target.closest(".code-block");
  const pre = block?.querySelector("pre");
  if (!block || !pre) return false;
  const button = target.closest<HTMLButtonElement>("[data-code-action]");
  if (button) {
    if (button.dataset.codeAction === "wrap") toggleWrap(block, button);
    else copyCode(pre, button);
    return true;
  }
  // Selecting code must not toggle the buttons under the selection.
  if (
    !touchOnly.matches ||
    target.closest("a") ||
    window.getSelection()?.isCollapsed === false
  ) {
    return false;
  }
  block.classList.toggle("code-tools-hidden");
  return true;
}

function toggleWrap(block: Element, button: HTMLButtonElement) {
  const wrapped = block.classList.toggle("code-wrapped");
  button.setAttribute("aria-pressed", String(wrapped));
}

async function copyCode(pre: HTMLPreElement, button: HTMLButtonElement) {
  try {
    await navigator.clipboard.writeText(pre.textContent ?? "");
  } catch {
    // The clipboard is unavailable outside secure contexts or without
    // permission, so select the code for the reader to copy instead.
    window.getSelection()?.selectAllChildren(pre);
    return;
  }
  showCopied(button);
}

const copiedTimers = new WeakMap<HTMLButtonElement, number>();
function showCopied(button: HTMLButtonElement) {
  button.classList.add("code-copied");
  button.setAttribute("aria-label", "Copied");
  clearTimeout(copiedTimers.get(button));
  copiedTimers.set(
    button,
    window.setTimeout(() => {
      button.classList.remove("code-copied");
      button.setAttribute("aria-label", "Copy code");
    }, 1500),
  );
}
