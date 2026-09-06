import { NextResponse } from "next/server";
import { jsonError, withAuth } from "@/lib/api";
import { mapRow, readSpreadsheet, suggestMapping, type ImportField } from "@/lib/excel";
import { isValidPhone, normalizeStudentNumber } from "@/lib/utils";
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

  const studentNumbers = rows
    .map((row) => normalizeStudentNumber(mapRow(row, mapping).studentNumber ?? ""))
    .filter(Boolean);
  const existing = await Student.find({ studentNumber: { $in: studentNumbers } }).select("studentNumber");
  const existingSet = new Set(existing.map((item) => item.studentNumber));

  const validated = rows.map((row, index) => {
    const mapped = mapRow(row, mapping);
    const errors: string[] = [];
    if (!mapped.studentNumber) errors.push("Missing Student Number");
    if (!mapped.name) errors.push("Missing Name");
    if (!mapped.roll) errors.push("Missing Roll");
    if (!mapped.serial) errors.push("Missing Serial");
    if (!mapped.guardianPhone) errors.push("Missing Guardian Phone");
    else if (!isValidPhone(mapped.guardianPhone)) errors.push("Invalid Guardian Phone");
    if (!mapped.branch) errors.push("Missing Branch");
    if (!mapped.group) errors.push("Missing Group");
    if (!mapped.batch) errors.push("Missing Batch");

    const studentNumber = mapped.studentNumber ? normalizeStudentNumber(mapped.studentNumber) : "";
    return {
      rowNumber: index + 2,
      roll: mapped.roll ?? "",
      serial: mapped.serial ?? "",
      name: mapped.name ?? "",
      studentNumber,
      guardianPhone: mapped.guardianPhone ?? "",
      branch: mapped.branch ?? "",
      group: mapped.group ?? "",
      batch: mapped.batch ?? "",
      supportType: mapped.supportType || supportTypeName,
      description: mapped.description || description,
      isExistingStudent: existingSet.has(studentNumber),
      errors,
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
