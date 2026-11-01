import { getItem, peekItem } from "./api";
import type { HNItem } from "./types";

export interface ThreadCount {
  count: number;
  complete: boolean;
}

function contextChildren(context?: HNItem[]) {
  return new Map(context?.slice(0, -1).map((item, index) =>
    [item.id, [context![index + 1].id]]));
}

// Count all hidden descendants, not just the first page of immediate replies.
// Permalink views include only the ancestor path and the selected reply's tree.
export function knownThreadCount(root: HNItem, context?: HNItem[]): ThreadCount {
  const path = contextChildren(context);
  const items = new Map(context?.map((item) => [item.id, item]));
  items.set(root.id, root);
  const seen = new Set<number>();
  const pending = [root.id];
  let complete = true;
  while (pending.length) {
    const id = pending.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const item = items.get(id) ?? peekItem(id);
    if (item) pending.push(...(path.get(id) ?? item.kids ?? []));
    else complete = false;
  }
  return { count: seen.size, complete };
}

export async function loadThreadCount(
  root: HNItem,
  context: HNItem[] | undefined,
  signal: AbortSignal,
): Promise<ThreadCount> {
  const path = contextChildren(context);
  const items = new Map(context?.map((item) => [item.id, item]));
  items.set(root.id, root);
  const seen = new Set<number>();
  const pending = [root.id];
  let complete = true;
  while (pending.length && !signal.aborted) {
    // Keep count-only requests from filling the reader's shared request queue.
    const batch: number[] = [];
    while (pending.length && batch.length < 4) {
      const id = pending.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      batch.push(id);
    }
    await Promise.all(batch.map(async (id) => {
      try {
        const item = items.get(id) ?? peekItem(id) ?? await getItem(id);
        if (!signal.aborted) pending.push(...(path.get(id) ?? item?.kids ?? []));
      } catch {
        complete = false;
      }
    }));
  }
  return { count: seen.size, complete: complete && !signal.aborted };
}
