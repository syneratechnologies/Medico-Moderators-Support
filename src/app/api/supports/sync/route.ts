import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { findOrCreateLookup } from "@/lib/lookups";
import { isBlankRow, validateSheetRow } from "@/lib/sheet";
import { resolveStudent } from "@/lib/students";
import { normalizeStudentNumber } from "@/lib/utils";
import { Batch } from "@/models/Batch";
import { Branch } from "@/models/Branch";
import { Group } from "@/models/Group";
import { Student } from "@/models/Student";
import { Support } from "@/models/Support";
import { SupportType } from "@/models/SupportType";

const rowSchema = z.object({
  supportId: z.string().optional(),
  studentId: z.string().optional(),
  roll: z.string(),
  serial: z.string(),
  name: z.string(),
  studentNumber: z.string(),
  guardianPhone: z.string(),
  branch: z.string(),
  group: z.string(),
  batch: z.string(),
  supportType: z.string(),
  description: z.string().optional().default(""),
  priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
});

export async function POST(request: Request) {
  const { user, error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;

  const parsed = z.object({ rows: z.array(rowSchema) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Sheet rows are required");

  const filled = parsed.data.rows.filter((row) => !isBlankRow(row));
  if (!filled.length) return jsonError("Add at least one support row");

  const numbers = filled.map((row) => normalizeStudentNumber(row.studentNumber)).filter(Boolean);
  const existing = await Student.find({ studentNumber: { $in: numbers } }).select("studentNumber");
  const existingSet = new Set(existing.map((item) => item.studentNumber));
  const invalid = filled
    .map((row, index) => ({ index, ...validateSheetRow(row, existingSet) }))
    .filter((row) => row.errors.length);
  if (invalid.length) {
    return NextResponse.json(
      { error: `Fix ${invalid.length} invalid row${invalid.length > 1 ? "s" : ""} before saving`, invalid },
      { status: 400 }
    );
  }

  let createdStudents = 0;
  let createdSupports = 0;
  let updatedSupports = 0;

  try {
    for (const row of filled) {
      const [branch, group, batch, supportType] = await Promise.all([
        findOrCreateLookup(Branch, row.branch),
        findOrCreateLookup(Group, row.group),
        findOrCreateLookup(Batch, row.batch),
        findOrCreateLookup(SupportType, row.supportType),
      ]);

      const resolved = await resolveStudent({
        studentId: row.studentId,
        roll: row.roll,
        serial: row.serial,
        name: row.name,
        studentNumber: row.studentNumber,
        guardianPhone: row.guardianPhone,
        branch: String(branch._id),
        group: String(group._id),
        batch: String(batch._id),
      });
      if (resolved.created) createdStudents += 1;
      const student = resolved.student;
      if (!student?.name?.trim() || !normalizeStudentNumber(row.studentNumber)) {
        continue;
      }

      if (row.supportId) {
        await Support.findByIdAndUpdate(row.supportId, {
          $set: {
            student: student._id,
            supportType: supportType._id,
            priority: row.priority ?? "medium",
          },
        });
        updatedSupports += 1;
      } else {
        await Support.create({
          student: student._id,
          supportType: supportType._id,
          createdBy: user.id,
          status: "pending",
          priority: row.priority ?? "medium",
        });
        createdSupports += 1;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Save failed";
    if (message.includes("E11000") || message.includes("duplicate key")) {
      return jsonError("This student number already exists. Phone/name updates stay on the existing profile.");
    }
    return jsonError(message, 500);
  }

  await logActivity({
    user,
    action: "Synced support sheet",
    targetType: "support",
    newValue: { createdStudents, createdSupports, updatedSupports },
  });

  return NextResponse.json({ createdStudents, createdSupports, updatedSupports });
}
