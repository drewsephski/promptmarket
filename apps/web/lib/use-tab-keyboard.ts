import { useCallback, type KeyboardEvent } from "react";

const TAB_NAV_KEYS = new Set([
  "ArrowRight",
  "ArrowDown",
  "ArrowLeft",
  "ArrowUp",
  "Home",
  "End",
]);

function moveIndex(current: number, delta: number, length: number): number {
  return (current + delta + length) % length;
}

export function resolveTabKeyboardTarget<T extends string>(
  items: readonly T[],
  selected: T | null,
  key: string,
): T | null {
  if (items.length === 0 || !TAB_NAV_KEYS.has(key)) {
    return null;
  }

  let index = selected ? items.indexOf(selected) : 0;
  if (index < 0) {
    index = 0;
  }

  if (key === "ArrowRight" || key === "ArrowDown") {
    return items[moveIndex(index, 1, items.length)] ?? null;
  }

  if (key === "ArrowLeft" || key === "ArrowUp") {
    return items[moveIndex(index, -1, items.length)] ?? null;
  }

  if (key === "Home") {
    return items[0] ?? null;
  }

  if (key === "End") {
    return items[items.length - 1] ?? null;
  }

  return null;
}

export function focusTabById(elementId: string): void {
  requestAnimationFrame(function focusAfterCommit() {
    const element = document.getElementById(elementId);
    if (element instanceof HTMLElement) {
      element.focus({ preventScroll: true });
    }
  });
}

export function useTabKeyboard<T extends string>(
  items: readonly T[],
  selected: T | null,
  onSelect: (id: T) => void,
  tabIdForItem?: (id: T) => string,
) {
  return useCallback(
    function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
      const next = resolveTabKeyboardTarget(items, selected, event.key);
      if (!next) {
        return;
      }

      event.preventDefault();
      onSelect(next);
      if (tabIdForItem) {
        focusTabById(tabIdForItem(next));
      }
    },
    [items, onSelect, selected, tabIdForItem],
  );
}
