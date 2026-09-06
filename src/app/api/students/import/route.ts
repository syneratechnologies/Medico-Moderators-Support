import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { findOrCreateLookup } from "@/lib/lookups";
import { isBlankRow, validateSheetRow } from "@/lib/sheet";
import { findStudentByNumber, studentPayload } from "@/lib/students";
import { normalizeStudentNumber } from "@/lib/utils";
import { Batch } from "@/models/Batch";
import { Branch } from "@/models/Branch";
import { Group } from "@/models/Group";
import { Student } from "@/models/Student";

const rowSchema = z.object({
  roll: z.string(),
  serial: z.string(),
  name: z.string(),
  studentNumber: z.string(),
  guardianPhone: z.string(),
  branch: z.string(),
  group: z.string(),
  batch: z.string(),
});

export async function POST(request: Request) {
  const { user, error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;

  const parsed = z.object({ rows: z.array(rowSchema) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Sheet rows are required");

  const filled = parsed.data.rows.filter((row) => !isBlankRow(row));
  if (!filled.length) return jsonError("Add at least one student row");

  const numbers = filled.map((row) => normalizeStudentNumber(row.studentNumber)).filter(Boolean);
  const existing = await Student.find({ studentNumber: { $in: numbers } }).select("studentNumber");
  const existingSet = new Set(existing.map((item) => item.studentNumber));
  const invalid = filled
    .map((row, index) => ({ index, ...validateSheetRow(row, existingSet) }))
    .filter((row) => row.errors.length);
  if (invalid.length) {
    return NextResponse.json(
      { error: `Fix ${invalid.length} invalid row${invalid.length > 1 ? "s" : ""} before importing`, invalid },
      { status: 400 }
    );
  }

  let createdStudents = 0;
  let skippedExisting = 0;
  const seen = new Set<string>();

  try {
    for (const row of filled) {
      const studentNumber = normalizeStudentNumber(row.studentNumber);
      if (!studentNumber || existingSet.has(studentNumber) || seen.has(studentNumber)) {
        skippedExisting += 1;
        continue;
      }

      const [branch, group, batch] = await Promise.all([
        findOrCreateLookup(Branch, row.branch),
        findOrCreateLookup(Group, row.group),
        findOrCreateLookup(Batch, row.batch),
      ]);

      if (await findStudentByNumber(studentNumber)) {
        skippedExisting += 1;
        seen.add(studentNumber);
        continue;
      }

      await Student.create(
        studentPayload({
          roll: row.roll,
          serial: row.serial,
          name: row.name,
          studentNumber,
          guardianPhone: row.guardianPhone,
          branch: String(branch._id),
          group: String(group._id),
          batch: String(batch._id),
        })
      );
      createdStudents += 1;
      seen.add(studentNumber);
      existingSet.add(studentNumber);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    if (message.includes("E11000") || message.includes("duplicate key")) {
      return jsonError("A student number in this file already exists. Existing students were skipped.");
    }
    return jsonError(message, 500);
  }

  await logActivity({
    user,
    action: "Imported students",
    targetType: "student",
    newValue: { createdStudents, skippedExisting },
  });

  return NextResponse.json({ createdStudents, skippedExisting });
}
