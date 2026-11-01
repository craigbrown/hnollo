export const pageScrollTop = () => window.scrollY;

export const pageScrollHeight = () =>
  document.scrollingElement?.scrollHeight ?? document.documentElement.scrollHeight;

export function pageViewport() {
  const viewport = window.visualViewport;
  const top = viewport?.offsetTop ?? 0;
  const height = viewport?.height ?? window.innerHeight;
  return { top, bottom: top + height, height };
}

export function scrollPage(top: number, behavior: ScrollBehavior = "instant") {
  window.scrollTo({ top: Math.max(0, top), behavior });
}
