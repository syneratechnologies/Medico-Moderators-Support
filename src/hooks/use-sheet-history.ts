"use client";

import { useCallback, useRef, useState } from "react";
import { cloneRows } from "@/lib/sheet-selection";
import type { SheetRow } from "@/lib/sheet";

export function useSheetHistory(initial: SheetRow[]) {
  const [rows, setRows] = useState(initial);
  const stack = useRef([cloneRows(initial)]);
  const pointer = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const flags = useCallback(() => {
    setCanUndo(pointer.current > 0);
    setCanRedo(pointer.current < stack.current.length - 1);
  }, []);

  const commit = useCallback((next: SheetRow[] | ((prev: SheetRow[]) => SheetRow[])) => {
    setRows((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      stack.current = [...stack.current.slice(0, pointer.current + 1), cloneRows(resolved)].slice(-80);
      pointer.current = stack.current.length - 1;
      queueMicrotask(flags);
      return resolved;
    });
  }, [flags]);

  const replaceSilent = useCallback((next: SheetRow[] | ((prev: SheetRow[]) => SheetRow[])) => {
    setRows(next);
  }, []);

  const undo = useCallback(() => {
    if (pointer.current <= 0) return;
    pointer.current -= 1;
    setRows(cloneRows(stack.current[pointer.current]));
    flags();
  }, [flags]);

  const redo = useCallback(() => {
    if (pointer.current >= stack.current.length - 1) return;
    pointer.current += 1;
    setRows(cloneRows(stack.current[pointer.current]));
    flags();
  }, [flags]);

  const reset = useCallback((next: SheetRow[]) => {
    stack.current = [cloneRows(next)];
    pointer.current = 0;
    setRows(next);
    flags();
  }, [flags]);

  return { rows, commit, replaceSilent, undo, redo, reset, canUndo, canRedo };
}
