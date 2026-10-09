/**
 * Keeps a file dropped anywhere on the apply page from opening in the tab and throwing the filled-in draft away.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/stray-drop.ts
 * Deps:    react
 * Tested:  src/app/apply/[tag]/__tests__/stray-drop.test.ts
 *
 * Key responsibilities:
 * - `installNoStrayDrop(target)`: cancels dragover and drop of files on the target (the window); returns the uninstall
 * - `useNoStrayDrop()`: the same for as long as the CV section is mounted, in file and in paste mode alike
 *
 * Design constraints:
 * - Only file drags are touched: dragging text into a field still works
 * - The drop zone handles its own drop first; this only swallows what lands beside it
 */
import { useEffect } from "react";

type Drag = Event & { dataTransfer?: { types: readonly string[] } | null };

export function installNoStrayDrop(target: EventTarget): () => void {
  const stop = (e: Event): void => {
    if ((e as Drag).dataTransfer?.types.includes("Files") === true) e.preventDefault();
  };
  target.addEventListener("dragover", stop);
  target.addEventListener("drop", stop);
  return () => {
    target.removeEventListener("dragover", stop);
    target.removeEventListener("drop", stop);
  };
}

export function useNoStrayDrop(): void {
  useEffect(() => installNoStrayDrop(window), []);
}
