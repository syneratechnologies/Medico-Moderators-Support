import { newSheetRow, SHEET_COLUMNS, type SheetField, type SheetRow } from "./sheet";

export type CellPos = { r: number; c: number };
export type SheetRange = { start: CellPos; end: CellPos };

export const LAST_COL = SHEET_COLUMNS.length - 1;

export function cloneRows(rows: SheetRow[]): SheetRow[] {
  return rows.map((row) => ({ ...row, errors: [...row.errors] }));
}

export function normalizeRange(range: SheetRange) {
  return {
    r1: Math.min(range.start.r, range.end.r),
    r2: Math.max(range.start.r, range.end.r),
    c1: Math.min(range.start.c, range.end.c),
    c2: Math.max(range.start.c, range.end.c),
  };
}

export function inRange(r: number, c: number, range: SheetRange) {
  const box = normalizeRange(range);
  return r >= box.r1 && r <= box.r2 && c >= box.c1 && c <= box.c2;
}

export function rangeSize(range: SheetRange) {
  const box = normalizeRange(range);
  return (box.r2 - box.r1 + 1) * (box.c2 - box.c1 + 1);
}

export function rangeLabel(range: SheetRange) {
  const box = normalizeRange(range);
  const col1 = SHEET_COLUMNS[box.c1]?.label ?? "";
  const col2 = SHEET_COLUMNS[box.c2]?.label ?? "";
  const rows = box.r1 === box.r2 ? `row ${box.r1 + 1}` : `rows ${box.r1 + 1}–${box.r2 + 1}`;
  const cols = box.c1 === box.c2 ? col1 : `${col1} → ${col2}`;
  return `${cols} · ${rows} · ${rangeSize(range)} cells`;
}

export function fieldAt(c: number): SheetField {
  return SHEET_COLUMNS[c].key;
}

export function cellValue(row: SheetRow, field: SheetField) {
  return String(row[field] ?? "");
}

export function applyValue(row: SheetRow, field: SheetField, value: string): SheetRow {
  return { ...row, [field]: value };
}

export function fillRange(rows: SheetRow[], range: SheetRange, value: string) {
  const box = normalizeRange(range);
  return rows.map((row, r) => {
    if (r < box.r1 || r > box.r2) return row;
    let next = row;
    for (let c = box.c1; c <= box.c2; c += 1) {
      next = applyValue(next, fieldAt(c), value);
    }
    return next;
  });
}

export function clearRange(rows: SheetRow[], range: SheetRange) {
  return fillRange(rows, range, "");
}

export function copyRange(rows: SheetRow[], range: SheetRange) {
  const box = normalizeRange(range);
  const lines: string[] = [];
  for (let r = box.r1; r <= box.r2; r += 1) {
    const cells: string[] = [];
    for (let c = box.c1; c <= box.c2; c += 1) {
      cells.push(cellValue(rows[r], fieldAt(c)));
    }
    lines.push(cells.join("\t"));
  }
  return lines.join("\n");
}

export function pasteAt(
  rows: SheetRow[],
  start: CellPos,
  text: string,
  extras?: Partial<SheetRow>
) {
  const next = cloneRows(rows);
  const lines = text.replace(/\r/g, "").split("\n").filter((line) => line.length > 0 || text.includes("\n"));
  lines.forEach((line, rowOffset) => {
    const r = start.r + rowOffset;
    while (next.length <= r) {
      next.push(newSheetRow({
        supportType: extras?.supportType ?? "",
        description: extras?.description ?? "",
      }));
    }
    line.split("\t").forEach((value, colOffset) => {
      const c = start.c + colOffset;
      if (c > LAST_COL) return;
      next[r] = applyValue(next[r], fieldAt(c), value.trim());
    });
  });
  return next;
}

export function deleteRows(rows: SheetRow[], range: SheetRange) {
  const box = normalizeRange(range);
  return rows.filter((_, index) => index < box.r1 || index > box.r2);
}

export function wholeRow(r: number): SheetRange {
  return { start: { r, c: 0 }, end: { r, c: LAST_COL } };
}

export function wholeColumn(c: number, rowCount: number): SheetRange {
  return { start: { r: 0, c }, end: { r: Math.max(0, rowCount - 1), c } };
}
