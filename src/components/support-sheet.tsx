"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useSheetHistory } from "@/hooks/use-sheet-history";
import { api } from "@/lib/client";
import type { ImportField } from "@/lib/excel";
import {
  isBlankRow,
  newSheetRow,
  SHEET_COLUMNS,
  sheetRowPayload,
  summarizeSheet,
  type SheetField,
  type SheetRow,
} from "@/lib/sheet";
import {
  applyValue,
  cellValue,
  clearRange,
  copyRange,
  fieldAt,
  fillRange,
  inRange,
  LAST_COL,
  normalizeRange,
  pasteAt,
  rangeLabel,
  rangeSize,
  wholeColumn,
  wholeRow,
  type SheetRange,
} from "@/lib/sheet-selection";
import { cn } from "@/lib/utils";
import { Button, Card, Field, Input, Select } from "./ui";

type Lookups = {
  branches: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  batches: { id: string; name: string }[];
  supportTypes: { id: string; name: string }[];
};

type Preview = {
  headers: string[];
  mapping: Record<string, ImportField | "">;
  rows: Array<Partial<SheetRow> & { rowNumber?: number }>;
};

const FIELDS: Array<ImportField | ""> = [
  "",
  "roll",
  "serial",
  "name",
  "studentNumber",
  "guardianPhone",
  "branch",
  "group",
  "batch",
];

const LISTS: Partial<Record<SheetField, keyof Lookups>> = {
  branch: "branches",
  group: "groups",
  batch: "batches",
};

function blankSheet() {
  return [] as ReturnType<typeof newSheetRow>[];
}

export function SupportSheet({
  lookups,
  canEdit = true,
}: {
  lookups: Lookups | null;
  canEdit?: boolean;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLInputElement>(null);
  const { rows, commit, replaceSilent, undo, redo, reset, canUndo, canRedo } = useSheetHistory(blankSheet());
  const [defaults, setDefaults] = useState({ branch: "", group: "", batch: "" });
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<Record<string, ImportField | "">>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [showMapping, setShowMapping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<SheetRange>({ start: { r: 0, c: 0 }, end: { r: 0, c: 0 } });
  const [dragging, setDragging] = useState<"cell" | "row" | "col" | null>(null);
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [fillValue, setFillValue] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({
    branch: "",
    group: "",
    batch: "",
  });
  const [checked, setChecked] = useState<string[]>([]);
  const [bulkField, setBulkField] = useState<SheetField>("branch");
  const [bulkValue, setBulkValue] = useState("");
  const clipboard = useRef("");

  useEffect(() => {
    if (!lookups) return;
    setDefaults((current) => ({
      branch: current.branch || lookups.branches[0]?.name || "",
      group: current.group || lookups.groups[0]?.name || "",
      batch: current.batch || lookups.batches[0]?.name || "",
    }));
  }, [lookups]);

  const visibleIndexes = useMemo(() => {
    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => {
        if (isBlankRow(row)) return true;
        const text = `${row.name} ${row.studentNumber} ${row.roll} ${row.description}`.toLowerCase();
        if (query && !text.includes(query.toLowerCase())) return false;
        if (filters.branch && row.branch !== filters.branch) return false;
        if (filters.group && row.group !== filters.group) return false;
        if (filters.batch && row.batch !== filters.batch) return false;
        return true;
      })
      .map(({ index }) => index);
  }, [rows, query, filters]);

  const visibleRows = visibleIndexes.map((index) => rows[index]).filter((row) => !isBlankRow(row));
  const summary = useMemo(() => summarizeSheet(rows), [rows]);
  const box = normalizeRange(selection);
  const selectedCount = rangeSize(selection);
  const activeField = fieldAt(box.c1);

  useEffect(() => {
    const first = rows[box.r1];
    if (!first || editing) return;
    setFillValue(cellValue(first, fieldAt(box.c1)));
  }, [box.r1, box.c1, rows, editing]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const filled = rows.filter((row) => !isBlankRow(row));
      if (!filled.length) return;
      api<{ rows: SheetRow[] }>("/api/supports/validate", {
        method: "POST",
        body: JSON.stringify({ rows: filled }),
      })
        .then((data) => {
          const byId = new Map(data.rows.map((row) => [row.id, row]));
          replaceSilent((current) =>
            current.map((row) => {
              const next = byId.get(row.id);
              if (!next) return isBlankRow(row) ? { ...row, errors: [], isExistingStudent: false } : row;
              return { ...row, errors: next.errors, isExistingStudent: next.isExistingStudent };
            })
          );
        })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [replaceSilent, rows.map((row) => `${row.id}:${row.studentNumber}:${row.name}:${row.roll}:${row.serial}:${row.guardianPhone}:${row.branch}:${row.group}:${row.batch}:${row.supportType}:${row.description}`).join("|")]);

  useEffect(() => {
    function onUp() {
      setDragging(null);
    }
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);

  function selectCell(r: number, c: number, extend = false) {
    setSelection((current) =>
      extend ? { ...current, end: { r, c } } : { start: { r, c }, end: { r, c } }
    );
    setEditing(null);
  }

  function applyFill(value = fillValue) {
    commit((current) => fillRange(current, selection, value));
    sheetRef.current?.focus();
  }

  function clearSelected() {
    commit((current) => clearRange(current, selection));
  }

  function targetIds(mode: "checked" | "filtered" | "selection") {
    if (mode === "checked" && checked.length) {
      return checked;
    }
    if (mode === "selection") {
      return rows
        .filter((_, index) => index >= box.r1 && index <= box.r2 && !isBlankRow(rows[index]))
        .map((row) => row.id);
    }
    return visibleIndexes.map((index) => rows[index]).filter((row) => !isBlankRow(row)).map((row) => row.id);
  }

  async function deleteByIds(ids: string[]) {
    if (!ids.length) return toast.error("Select rows to delete");
    commit((current) => current.filter((row) => !ids.includes(row.id)));
    setChecked([]);
    toast.success(`${ids.length} row(s) deleted`);
  }

  function removeSelectedRows() {
    deleteByIds(targetIds(checked.length ? "checked" : "selection"));
  }

  function addRows(count = 1) {
    commit((current) => [
      ...current,
      ...Array.from({ length: count }, () =>
        newSheetRow()
      ),
    ]);
  }

  function removeRow(id: string) {
    deleteByIds([id]);
  }

  async function applyBulk(mode: "checked" | "filtered") {
    const ids = targetIds(mode);
    if (!ids.length) return toast.error(mode === "checked" ? "Check some rows first" : "No filtered rows");
    commit((current) =>
      current.map((row) => {
        if (!ids.includes(row.id) || isBlankRow(row)) return row;
        return applyValue(row, bulkField, bulkValue);
      })
    );
    toast.success(`Updated ${ids.length} row(s). Confirm import to create new students.`);
  }

  async function copySelected() {
    const text = copyRange(rows, selection);
    clipboard.current = text;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // browser may block clipboard; internal buffer still works
    }
    toast.success(`Copied ${selectedCount} cells`);
  }

  function cutSelected() {
    copySelected();
    clearSelected();
  }

  function pasteText(text: string) {
    commit((current) =>
      pasteAt(current, selection.start, text)
    );
  }

  async function loadFile(nextFile: File, nextMapping?: Record<string, ImportField | "">) {
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", nextFile);
      form.append("supportType", "");
      form.append("description", "");
      form.append("mapping", JSON.stringify(nextMapping ?? mapping));
      const data = await api<Preview>("/api/import/preview", { method: "POST", body: form });
      setHeaders(data.headers);
      setMapping(data.mapping);
      const imported = data.rows
        .map((row) =>
          newSheetRow({
            roll: row.roll ?? "",
            serial: row.serial ?? "",
            name: row.name ?? "",
            studentNumber: row.studentNumber ?? "",
            guardianPhone: row.guardianPhone ?? "",
            branch: row.branch ?? "",
            group: row.group ?? "",
            batch: row.batch ?? "",
            supportType: "",
            description: row.description || "",
            isExistingStudent: row.isExistingStudent,
            errors: row.errors ?? [],
          })
        )
        .filter((row) => !isBlankRow(row));
      commit((current) => [
        ...current.filter((row) => row.persisted || !isBlankRow(row)),
        ...imported,
      ]);
      setShowMapping(true);
      toast.success(`${imported.length} rows added to the sheet. Edit anything, then confirm to save.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read file");
    } finally {
      setLoading(false);
    }
  }

  function applyDefaults() {
    commit((current) =>
      current.map((row) =>
        isBlankRow(row)
          ? row
          : {
              ...row,
              branch: row.branch || defaults.branch,
              group: row.group || defaults.group,
              batch: row.batch || defaults.batch,
            }
      )
    );
  }

  function startEdit(r: number, c: number) {
    setSelection({ start: { r, c }, end: { r, c } });
    setEditing({ r, c });
    setEditValue(cellValue(rows[r], fieldAt(c)));
  }

  function commitEdit() {
    if (!editing) return;
    const { r, c } = editing;
    commit((current) => fillRange(current, { start: { r, c }, end: { r, c } }, editValue));
    setEditing(null);
  }

  function onSheetKey(event: React.KeyboardEvent) {
    const key = event.key;
    const ctrl = event.ctrlKey || event.metaKey;
    if (editing) return;

    if (ctrl && key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (ctrl && key.toLowerCase() === "y") {
      event.preventDefault();
      redo();
      return;
    }
    if (ctrl && key.toLowerCase() === "c") {
      event.preventDefault();
      copySelected();
      return;
    }
    if (ctrl && key.toLowerCase() === "x") {
      event.preventDefault();
      cutSelected();
      return;
    }
    if (ctrl && key.toLowerCase() === "v") {
      event.preventDefault();
      navigator.clipboard.readText().then(pasteText).catch(() => {
        if (clipboard.current) pasteText(clipboard.current);
      });
      return;
    }
    if (key === "Delete" || key === "Backspace") {
      event.preventDefault();
      clearSelected();
      return;
    }
    if (key === "Enter") {
      event.preventDefault();
      applyFill();
      return;
    }
    if (key === "Escape") {
      setSelection({ start: selection.start, end: selection.start });
      return;
    }
    if (key.startsWith("Arrow")) {
      event.preventDefault();
      const move = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[key] ?? [0, 0];
      const r = Math.max(0, Math.min(rows.length - 1, selection.end.r + move[0]));
      const c = Math.max(0, Math.min(LAST_COL, selection.end.c + move[1]));
      selectCell(r, c, event.shiftKey);
      return;
    }
    if (key.length === 1 && !ctrl) {
      event.preventDefault();
      setFillValue(key);
      fillRef.current?.focus();
    }
  }

  async function confirmUpload() {
    if (summary.invalid > 0) {
      toast.error("Fix every highlighted row before upload");
      return;
    }
    if (!summary.newStudents) {
      toast.error("No new students to import. Existing S-Numbers are skipped.");
      return;
    }
    setLoading(true);
    try {
      const result = await api<{ createdStudents: number; skippedExisting: number }>("/api/students/import", {
        method: "POST",
        body: JSON.stringify({
          rows: rows.filter((row) => !isBlankRow(row)).map(sheetRowPayload),
        }),
      });
      toast.success(`${result.createdStudents} new students created · ${result.skippedExisting} already existed`);
      setShowMapping(false);
      reset([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] xl:grid-cols-[220px_1fr_1fr_auto]">
          <Field label="Excel / CSV">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="w-full rounded-2xl border border-[#ddd4c4] bg-white px-3.5 py-2.5 text-sm"
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                setFile(next);
                if (next) loadFile(next);
              }}
            />
          </Field>
          <Field label="Default branch">
            <Select value={defaults.branch} onChange={(event) => setDefaults({ ...defaults, branch: event.target.value })}>
              {lookups?.branches.map((item) => (
                <option key={item.id}>{item.name}</option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end gap-2">
            <Button variant="secondary" type="button" onClick={applyDefaults}>
              Fill defaults
            </Button>
            <Button variant="secondary" type="button" onClick={() => addRows(5)}>
              Add 5 rows
            </Button>
          </div>
        </div>
        <p className="mt-3 text-sm text-[#5d6f6b]">
          Import Excel or type new students. Existing S-Numbers are skipped. Supports are created from the Students page.
        </p>
      </Card>
      ) : null}
      <Card className="space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, roll, S-Number" />
          <Select value={filters.branch} onChange={(event) => setFilters({ ...filters, branch: event.target.value })}>
            <option value="">All branches</option>
            {lookups?.branches.map((item) => <option key={item.id}>{item.name}</option>)}
          </Select>
          <Select value={filters.group} onChange={(event) => setFilters({ ...filters, group: event.target.value })}>
            <option value="">All groups</option>
            {lookups?.groups.map((item) => <option key={item.id}>{item.name}</option>)}
          </Select>
          <Select value={filters.batch} onChange={(event) => setFilters({ ...filters, batch: event.target.value })}>
            <option value="">All batches</option>
            {lookups?.batches.map((item) => <option key={item.id}>{item.name}</option>)}
          </Select>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Change field">
              <Select
                value={bulkField}
                onChange={(event) => {
                  setBulkField(event.target.value as SheetField);
                  setBulkValue("");
                }}
              >
                <option value="branch">Branch</option>
                <option value="group">Group</option>
                <option value="batch">Batch</option>
              </Select>
            </Field>
            <Field label="New value">
              {LISTS[bulkField] ? (
                <Select value={bulkValue} onChange={(event) => setBulkValue(event.target.value)}>
                  <option value="">Select</option>
                  {(lookups?.[LISTS[bulkField as SheetField]!] ?? []).map((item) => (
                    <option key={item.id}>{item.name}</option>
                  ))}
                </Select>
              ) : (
                <Input value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} placeholder="Value for filtered rows" />
              )}
            </Field>
            <Button type="button" onClick={() => applyBulk("filtered")}>
              Apply to filtered ({visibleRows.length})
            </Button>
            <Button variant="secondary" type="button" onClick={() => applyBulk("checked")}>
              Apply to checked ({checked.length})
            </Button>
            <Button variant="secondary" type="button" onClick={() => setChecked(visibleRows.map((row) => row.id))}>
              Check filtered
            </Button>
            <Button variant="danger" type="button" onClick={() => deleteByIds(checked.length ? checked : targetIds("filtered"))}>
              Delete {checked.length ? "checked" : "filtered"}
            </Button>
          </div>
        ) : null}
      </Card>

      {showMapping && headers.length > 0 ? (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium">Column mapping</h3>
            <Button variant="secondary" disabled={!file || loading} onClick={() => file && loadFile(file, mapping)}>
              Re-read with mapping
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {headers.map((header) => (
              <label key={header} className="grid grid-cols-[1fr_1fr] items-center gap-2 text-sm">
                <span className="truncate text-[#5d6f6b]">{header}</span>
                <Select
                  value={mapping[header] ?? ""}
                  onChange={(event) => setMapping({ ...mapping, [header]: event.target.value as ImportField | "" })}
                >
                  {FIELDS.map((field) => (
                    <option key={field || "skip"} value={field}>
                      {field || "Ignore"}
                    </option>
                  ))}
                </Select>
              </label>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["In sheet", summary.total],
          ["Ready", summary.valid],
          ["Need fix", summary.invalid],
          ["New students", summary.newStudents],
          ["Existing", summary.existingStudents],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-[#ddd4c4] bg-[#fffdf8] px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-[#5d6f6b]">{label}</p>
            <p className="font-[family-name:var(--font-fraunces)] text-3xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[#c8bda8] bg-white p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="min-w-[220px] text-xs font-medium uppercase tracking-wide text-[#5d6f6b]">
            {rangeLabel(selection)}
          </p>
          <input
              ref={fillRef}
              list={LISTS[activeField]}
              className="min-w-[240px] flex-1 rounded-xl border border-[#ddd4c4] px-3 py-2 text-sm"
              value={fillValue}
              placeholder="Type a value for the selected cells, then Enter"
              onChange={(event) => setFillValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyFill(event.currentTarget.value);
                }
                if (event.key === "Escape") sheetRef.current?.focus();
              }}
            />
          <Button type="button" onClick={() => applyFill()}>Apply to selection</Button>
          <Button variant="secondary" type="button" disabled={!canUndo} onClick={undo}>Undo</Button>
          <Button variant="secondary" type="button" disabled={!canRedo} onClick={redo}>Redo</Button>
          <Button variant="secondary" type="button" onClick={copySelected}>Copy</Button>
          <Button variant="secondary" type="button" onClick={cutSelected}>Cut</Button>
          <Button variant="ghost" type="button" onClick={clearSelected}>Clear</Button>
          <Button variant="ghost" type="button" onClick={removeSelectedRows}>Delete rows</Button>
        </div>
        <p className="mb-2 text-xs text-[#5d6f6b]">
          Drag to select · Shift+click to extend · click a column header for that whole column · type + Enter fills the range · Ctrl+Z undo
        </p>

        <div
          ref={sheetRef}
          tabIndex={0}
          className="sheet-wrap overflow-auto rounded-xl border border-[#c8bda8] outline-none"
          onKeyDown={onSheetKey}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text/plain");
            if (!text) return;
            event.preventDefault();
            pasteText(text);
          }}
        >
          <table className="sheet-table min-w-max select-none border-collapse text-sm">
            <thead>
              <tr>
                <th className="sheet-head w-8"></th>
                <th className="sheet-head sticky left-0 z-10 w-10">#</th>
                {SHEET_COLUMNS.map((column, c) => (
                  <th
                    key={column.key}
                    className={cn("sheet-head cursor-pointer", box.c1 <= c && c <= box.c2 && "sheet-head-active")}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setDragging("col");
                      setSelection(
                        event.shiftKey
                          ? { ...selection, end: { r: rows.length - 1, c } }
                          : wholeColumn(c, rows.length)
                      );
                      sheetRef.current?.focus();
                    }}
                    onMouseEnter={() => {
                      if (dragging === "col") {
                        setSelection((current) => ({ ...current, end: { r: rows.length - 1, c } }));
                      }
                    }}
                  >
                    {column.label}
                  </th>
                ))}
                <th className="sheet-head">Match</th>
                <th className="sheet-head">Issues</th>
                <th className="sheet-head w-12"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    className="sheet-meta px-4 py-8 text-center text-[#5d6f6b]"
                    colSpan={SHEET_COLUMNS.length + 4}
                  >
                    No rows yet. Click Add row or import an Excel file.
                  </td>
                </tr>
              ) : null}
              {rows.map((row, r) => {
                if (!visibleIndexes.includes(r)) return null;
                const blank = isBlankRow(row);
                const bad = !blank && row.errors.length > 0;
                return (
                  <tr key={row.id} className={cn(bad && "sheet-error", !blank && !bad && "sheet-ok")}>
                    <td className="sheet-meta">
                      {blank ? null : (
                        <input
                          type="checkbox"
                          checked={checked.includes(row.id)}
                          onChange={() => {
                            setChecked((current) =>
                              current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id]
                            );
                          }}
                        />
                      )}
                    </td>
                    <td
                      className={cn("sheet-index sticky left-0 cursor-pointer", box.r1 <= r && r <= box.r2 && "sheet-index-active")}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setDragging("row");
                        setSelection(event.shiftKey ? { ...selection, end: { r, c: LAST_COL } } : wholeRow(r));
                        sheetRef.current?.focus();
                      }}
                      onMouseEnter={() => {
                        if (dragging === "row") {
                          setSelection((current) => ({ ...current, end: { r, c: LAST_COL } }));
                        }
                      }}
                    >
                      {r + 1}
                    </td>
                    {SHEET_COLUMNS.map((column, c) => {
                      const selected = inRange(r, c, selection);
                      const active = selection.start.r === r && selection.start.c === c;
                      const isEditing = editing?.r === r && editing?.c === c;
                      return (
                        <td
                          key={column.key}
                          className={cn("sheet-cell", selected && "sheet-selected", active && "sheet-active")}
                          onMouseDown={(event) => {
                            if (isEditing) return;
                            event.preventDefault();
                            setDragging("cell");
                            selectCell(r, c, event.shiftKey);
                            sheetRef.current?.focus();
                          }}
                          onMouseEnter={() => {
                            if (dragging === "cell") {
                              setSelection((current) => ({ ...current, end: { r, c } }));
                            }
                          }}
                          onDoubleClick={() => {
                            if (canEdit) startEdit(r, c);
                          }}
                        >
                          {isEditing ? (
                              <input
                                autoFocus
                                className="sheet-input"
                                list={LISTS[column.key]}
                                value={editValue}
                                onChange={(event) => setEditValue(event.target.value)}
                                onBlur={commitEdit}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    commitEdit();
                                  }
                                  if (event.key === "Escape") setEditing(null);
                                }}
                              />
                          ) : (
                            <span className="sheet-value">{cellValue(row, column.key)}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="sheet-meta">{blank ? "" : row.isExistingStudent ? "Already exists · skip" : "New student"}</td>
                    <td className="sheet-meta text-[#b24a45]">{blank ? "" : row.errors.join(" · ")}</td>
                    <td className="sheet-meta">
                      <button type="button" className="text-xs text-[#8a5a12]" onClick={() => removeRow(row.id)}>
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {lookups
          ? (Object.entries(LISTS) as Array<[SheetField, keyof Lookups]>).map(([field, key]) => (
              <datalist id={key} key={field}>
                {lookups[key].map((item) => (
                  <option key={item.id} value={item.name} />
                ))}
              </datalist>
            ))
          : null}
      </div>

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ddd4c4] bg-[#fffdf8]/95 px-4 py-3 backdrop-blur">
        <p className="text-sm text-[#5d6f6b]">
          {selectedCount > 1
            ? `${selectedCount} cells selected. Enter a value and press Enter to change all of them.`
            : "Double-click a cell to edit one value. Drag to select a range."}
        </p>
        {canEdit ? (
        <div className="flex gap-2">
          <Button variant="secondary" type="button" onClick={() => addRows(1)}>
            Add row
          </Button>
          <Button disabled={loading || summary.newStudents === 0 || summary.invalid > 0} onClick={confirmUpload}>
            {loading ? "Importing…" : `Import ${summary.newStudents} new students`}
          </Button>
        </div>
        ) : null}
      </div>
    </div>
  );
}
