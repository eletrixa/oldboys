/**
 * Tests for the stray-drop guard: a file dropped beside the CV zone never navigates the tab away from the draft.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/__tests__/stray-drop.test.ts
 * Deps:    vitest, ../stray-drop
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - File drags (dragover and drop) are cancelled on the target; text drags are left alone; the uninstall works
 *
 * Design constraints:
 * - Pure Node: a plain EventTarget and Events carrying a `dataTransfer`, no DOM
 */
import { describe, expect, it } from "vitest";
import { installNoStrayDrop } from "../stray-drop";

function drag(type: "dragover" | "drop", types: string[]): Event {
  const e = new Event(type, { cancelable: true });
  Object.defineProperty(e, "dataTransfer", { value: { types } });
  return e;
}

describe("installNoStrayDrop", () => {
  it("cancels file drags so the browser never opens the file in the tab", () => {
    const target = new EventTarget();
    installNoStrayDrop(target);
    for (const type of ["dragover", "drop"] as const) {
      const e = drag(type, ["Files"]);
      target.dispatchEvent(e);
      expect(e.defaultPrevented).toBe(true);
    }
  });

  it("leaves text drags alone, so dragging text into a field still works", () => {
    const target = new EventTarget();
    installNoStrayDrop(target);
    const e = drag("drop", ["text/plain"]);
    target.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it("stops guarding once uninstalled", () => {
    const target = new EventTarget();
    installNoStrayDrop(target)();
    const e = drag("drop", ["Files"]);
    target.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });
});
