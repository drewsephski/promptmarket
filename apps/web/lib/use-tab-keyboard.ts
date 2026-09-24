import { useCallback, type KeyboardEvent } from "react";

export function useTabKeyboard<T extends string>(
  items: readonly T[],
  selected: T | null,
  onSelect: (id: T) => void,
) {
  return useCallback(
    function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
      if (items.length === 0) {
        return;
      }

      const move = function nextIndex(current: number, delta: number): number {
        const length = items.length;
        return (current + delta + length) % length;
      };

      let index = selected ? items.indexOf(selected) : 0;
      if (index < 0) {
        index = 0;
      }

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        const next = items[move(index, 1)];
        if (next) {
          onSelect(next);
        }
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        const previous = items[move(index, -1)];
        if (previous) {
          onSelect(previous);
        }
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        const first = items[0];
        if (first) {
          onSelect(first);
        }
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        const last = items[items.length - 1];
        if (last) {
          onSelect(last);
        }
      }
    },
    [items, onSelect, selected],
  );
}
