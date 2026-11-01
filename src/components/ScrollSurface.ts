import { createContext, useContext } from "react";
import type { RefObject } from "react";

export const ScrollSurface = createContext<{
  contentRef: RefObject<HTMLElement | null>;
  active: boolean;
}>(null!);

export const useScrollSurface = () => useContext(ScrollSurface);
