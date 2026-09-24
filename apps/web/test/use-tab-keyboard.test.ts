import { describe, expect, test } from "vitest";
import { resolveTabKeyboardTarget } from "../lib/use-tab-keyboard";

const items = ["a", "b", "c"] as const;

describe("resolveTabKeyboardTarget", function tabKeyboard() {
  test("wraps with arrow keys from the selected tab", function arrows() {
    expect(resolveTabKeyboardTarget(items, "b", "ArrowRight")).toBe("c");
    expect(resolveTabKeyboardTarget(items, "b", "ArrowLeft")).toBe("a");
    expect(resolveTabKeyboardTarget(items, "b", "ArrowDown")).toBe("c");
    expect(resolveTabKeyboardTarget(items, "b", "ArrowUp")).toBe("a");
  });

  test("uses the first item when nothing is selected", function noSelection() {
    expect(resolveTabKeyboardTarget(items, null, "ArrowRight")).toBe("b");
    expect(resolveTabKeyboardTarget(items, null, "Home")).toBe("a");
  });

  test("jumps to ends with Home and End", function homeEnd() {
    expect(resolveTabKeyboardTarget(items, "b", "Home")).toBe("a");
    expect(resolveTabKeyboardTarget(items, "b", "End")).toBe("c");
  });

  test("ignores unrelated keys", function ignore() {
    expect(resolveTabKeyboardTarget(items, "a", "Enter")).toBeNull();
  });
});
