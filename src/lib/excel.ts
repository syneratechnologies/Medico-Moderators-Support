import ExcelJS from "exceljs";
import { STUDENT_FIELDS, type StudentField } from "./types";

export const SYSTEM_FIELDS = [
  ...STUDENT_FIELDS,
  "supportType",
  "description",
] as const;

export type ImportField = (typeof SYSTEM_FIELDS)[number];

const ALIASES: Record<string, ImportField> = {
  roll: "roll",
  "roll no": "roll",
  "roll number": "roll",
  serial: "serial",
  "serial no": "serial",
  name: "name",
  "student name": "name",
  "full name": "name",
  "student number": "studentNumber",
  "student no": "studentNumber",
  "s-number": "studentNumber",
  "s number": "studentNumber",
  snumber: "studentNumber",
  "student id": "studentNumber",
  "studentid": "studentNumber",
  "guardian phone": "guardianPhone",
  "guardian contact": "guardianPhone",
  "guardian mobile": "guardianPhone",
  "g-number": "guardianPhone",
  "g number": "guardianPhone",
  gnumber: "guardianPhone",
  phone: "guardianPhone",
  mobile: "guardianPhone",
  branch: "branch",
  campus: "branch",
  group: "group",
  batch: "batch",
  "support type": "supportType",
  type: "supportType",
  description: "description",
  "support description": "description",
  remarks: "description",
};

export function suggestMapping(headers: string[]) {
  const mapping: Record<string, ImportField | ""> = {};
  for (const header of headers) {
    const key = header.trim().toLowerCase();
    mapping[header] = ALIASES[key] ?? "";
  }
  return mapping;
}

export async function readSpreadsheet(buffer: ArrayBuffer, fileName = "") {
  if (fileName.toLowerCase().endsWith(".csv")) {
    const text = new TextDecoder().decode(buffer);
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    const headers = (lines[0] ?? "").split(",").map((item) => item.trim().replace(/^"|"$/g, ""));
    const rows = lines.slice(1).map((line) => {
      const values = line.split(",").map((item) => item.trim().replace(/^"|"$/g, ""));
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = values[index] ?? "";
      });
      return record;
    });
    return { headers: headers.filter(Boolean), rows };
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [] as string[], rows: [] as Record<string, string>[] };

  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, col) => {
    headers[col - 1] = String(cell.value ?? "").trim();
  });

  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const record: Record<string, string> = {};
    headers.forEach((header, colIndex) => {
      const cell = row.getCell(colIndex + 1);
      record[header] = cell.text?.trim() || String(cell.value ?? "").trim();
    });
    if (Object.values(record).some((value) => value)) {
      rows.push(record);
    }
  });

  return { headers: headers.filter(Boolean), rows };
}

export function mapRow(
  row: Record<string, string>,
  mapping: Record<string, ImportField | "">
) {
  const mapped: Partial<Record<ImportField, string>> = {};
  for (const [excelColumn, field] of Object.entries(mapping)) {
    if (!field) continue;
    mapped[field] = row[excelColumn]?.trim() ?? "";
  }
  return mapped;
}

export function requiredStudentFields(): StudentField[] {
  return [...STUDENT_FIELDS];
}
