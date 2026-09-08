import { NextResponse } from "next/server";
import { jsonError, withAuth } from "@/lib/api";
import { mapRow, readSpreadsheet, suggestMapping, type ImportField } from "@/lib/excel";
import { normalizeRoll } from "@/lib/utils";
import { Student } from "@/models/Student";
import { ImportJob } from "@/models/ImportJob";

export async function POST(request: Request) {
  const { user, error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;

  const form = await request.formData();
  const file = form.get("file");
  const mappingRaw = form.get("mapping");
  const supportTypeName = String(form.get("supportType") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();

  if (!(file instanceof File)) return jsonError("Upload an Excel file");

  const buffer = await file.arrayBuffer();
  const { headers, rows } = await readSpreadsheet(buffer, file.name);
  if (!headers.length) return jsonError("No columns found in the spreadsheet");

  const mapping = mappingRaw
    ? (JSON.parse(String(mappingRaw)) as Record<string, ImportField | "">)
    : suggestMapping(headers);

  const rolls = rows.map((row) => normalizeRoll(mapRow(row, mapping).roll ?? "")).filter(Boolean);
  const existing = await Student.find({ roll: { $in: rolls } }).select("roll");
  const existingSet = new Set(existing.map((item) => String(item.roll ?? "")).filter(Boolean));

  const validated = rows.map((row, index) => {
    const mapped = mapRow(row, mapping);
    const roll = mapped.roll ? normalizeRoll(mapped.roll) : "";
    const studentNumber = mapped.studentNumber ? String(mapped.studentNumber).trim() : "";
    return {
      rowNumber: index + 2,
      roll,
      serial: mapped.serial ?? "",
      name: mapped.name ?? "",
      studentNumber,
      guardianPhone: mapped.guardianPhone ?? "",
      branch: mapped.branch ?? "",
      group: mapped.group ?? "",
      batch: mapped.batch ?? "",
      supportType: mapped.supportType || supportTypeName,
      description: mapped.description || description,
      isExistingStudent: Boolean(roll && existingSet.has(roll)),
      errors: [] as string[],
    };
  });

  const valid = validated.filter((row) => row.errors.length === 0);

  const validRows = validated.filter((row) => row.errors.length === 0);
  const summary = {
    total: validated.length,
    valid: validRows.length,
    invalid: validated.length - validRows.length,
    newStudents: validRows.filter((row) => !row.isExistingStudent).length,
    existingStudents: validRows.filter((row) => row.isExistingStudent).length,
  };

  const job = await ImportJob.create({
    createdBy: user.id,
    status: "preview",
    fileName: file.name,
    mapping,
    supportTypeName,
    description,
    rows: validated,
    summary,
    expiresAt: new Date(Date.now() + 1000 * 60 * 30),
  });

  return NextResponse.json({
    jobId: String(job._id),
    headers,
    mapping,
    summary,
    rows: validated,
    validCount: valid.length,
  });
}
