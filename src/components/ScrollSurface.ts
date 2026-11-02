import { createContext, useContext } from "react";
import type { RefObject } from "react";

export const ScrollSurface = createContext<{
  contentRef: RefObject<HTMLElement | null>;
  active: boolean;
  // Drawn under an edge swipe as the page it would go back to.
  preview: boolean;
}>(null!);

export const useScrollSurface = () => useContext(ScrollSurface);
