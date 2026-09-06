import { isValidPhone, normalizeStudentNumber } from "./utils";

export type SheetRow = {
  id: string;
  roll: string;
  serial: string;
  name: string;
  studentNumber: string;
  guardianPhone: string;
  branch: string;
  group: string;
  batch: string;
  supportType: string;
  description: string;
  priority: "low" | "medium" | "high";
  isExistingStudent: boolean;
  errors: string[];
  supportId?: string;
  studentId?: string;
  status: string;
  assignedModeratorId: string;
  persisted: boolean;
};

export const SHEET_COLUMNS = [
  { key: "roll", label: "Roll" },
  { key: "serial", label: "Serial" },
  { key: "name", label: "Name" },
  { key: "studentNumber", label: "S-Number" },
  { key: "guardianPhone", label: "G-Number" },
  { key: "branch", label: "Branch" },
  { key: "group", label: "Group" },
  { key: "batch", label: "Batch" },
] as const;

export type SheetField = (typeof SHEET_COLUMNS)[number]["key"];

export function newSheetRow(partial: Partial<SheetRow> = {}): SheetRow {
  return {
    id: partial.id ?? crypto.randomUUID(),
    roll: partial.roll ?? "",
    serial: partial.serial ?? "",
    name: partial.name ?? "",
    studentNumber: partial.studentNumber ?? "",
    guardianPhone: partial.guardianPhone ?? "",
    branch: partial.branch ?? "",
    group: partial.group ?? "",
    batch: partial.batch ?? "",
    supportType: partial.supportType ?? "",
    description: partial.description ?? "",
    priority: partial.priority ?? "medium",
    isExistingStudent: partial.isExistingStudent ?? false,
    errors: partial.errors ?? [],
    supportId: partial.supportId,
    studentId: partial.studentId,
    status: partial.status ?? "",
    assignedModeratorId: partial.assignedModeratorId ?? "",
    persisted: partial.persisted ?? false,
  };
}

export function supportToSheetRow(item: {
  id: string;
  status: string;
  description: string;
  priority?: string;
  supportType?: { name?: string };
  assignedModerator?: { id?: string } | null;
  student?: {
    id?: string;
    name?: string;
    studentNumber?: string;
    roll?: string;
    serial?: string;
    guardianPhone?: string;
    branch?: { name?: string };
    group?: { name?: string };
    batch?: { name?: string };
  };
}): SheetRow {
  return newSheetRow({
    id: item.id,
    supportId: item.id,
    studentId: item.student?.id,
    roll: item.student?.roll ?? "",
    serial: item.student?.serial ?? "",
    name: item.student?.name ?? "",
    studentNumber: String(item.student?.studentNumber ?? ""),
    guardianPhone: item.student?.guardianPhone ?? "",
    branch: item.student?.branch?.name ?? "",
    group: item.student?.group?.name ?? "",
    batch: item.student?.batch?.name ?? "",
    supportType: item.supportType?.name ?? "",
    description: item.description ?? "",
    priority: item.priority === "low" || item.priority === "high" ? item.priority : "medium",
    isExistingStudent: true,
    persisted: true,
    status: item.status,
    assignedModeratorId: item.assignedModerator?.id ?? "",
  });
}

export function isBlankRow(row: Pick<SheetRow, SheetField>) {
  return SHEET_COLUMNS.every((column) => !String(row[column.key] ?? "").trim());
}

export function validateSheetRow(
  row: Pick<SheetRow, SheetField>,
  existingNumbers?: Set<string>
) {
  const errors: string[] = [];
  if (!row.studentNumber.trim()) errors.push("Missing S-Number");
  if (!row.name.trim()) errors.push("Missing Name");
  if (!row.roll.trim()) errors.push("Missing Roll");
  if (!row.serial.trim()) errors.push("Missing Serial");
  if (!row.guardianPhone.trim()) errors.push("Missing G-Number");
  else if (!isValidPhone(row.guardianPhone)) errors.push("Invalid G-Number");
  if (!row.branch.trim()) errors.push("Missing Branch");
  if (!row.group.trim()) errors.push("Missing Group");
  if (!row.batch.trim()) errors.push("Missing Batch");

  const studentNumber = row.studentNumber ? normalizeStudentNumber(row.studentNumber) : "";
  return {
    errors,
    studentNumber,
    isExistingStudent: Boolean(studentNumber && existingNumbers?.has(studentNumber)),
  };
}

export function summarizeSheet(rows: SheetRow[]) {
  const filled = rows.filter((row) => !isBlankRow(row));
  const valid = filled.filter((row) => row.errors.length === 0);
  return {
    total: filled.length,
    valid: valid.length,
    invalid: filled.length - valid.length,
    newStudents: valid.filter((row) => !row.isExistingStudent).length,
    existingStudents: valid.filter((row) => row.isExistingStudent).length,
  };
}

export function sheetRowPayload(row: SheetRow) {
  return {
    supportId: row.supportId,
    studentId: row.studentId,
    roll: row.roll.trim(),
    serial: row.serial.trim(),
    name: row.name.trim(),
    studentNumber: normalizeStudentNumber(row.studentNumber),
    guardianPhone: row.guardianPhone.trim(),
    branch: row.branch.trim(),
    group: row.group.trim(),
    batch: row.batch.trim(),
    supportType: row.supportType.trim(),
    description: (row.description ?? "").trim(),
    priority: row.priority,
  };
}
