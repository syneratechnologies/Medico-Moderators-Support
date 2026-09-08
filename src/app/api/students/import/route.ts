import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { isBlankRow, validateSheetRow } from "@/lib/sheet";
import { studentPayload } from "@/lib/students";
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

type NamedDoc = { _id: unknown; name: string };

function indexLookups(docs: NamedDoc[]) {
  const byName = new Map<string, string>();
  const byId = new Map<string, string>();
  for (const doc of docs) {
    const id = String(doc._id);
    byId.set(id, id);
    byName.set(doc.name.trim().toLowerCase(), id);
  }
  return { byName, byId };
}

async function resolveLookupId(
  value: string,
  maps: ReturnType<typeof indexLookups>,
  model: typeof Branch | typeof Group | typeof Batch
) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Branch, group and batch cannot be empty");
  const existing = maps.byId.get(trimmed) ?? maps.byName.get(trimmed.toLowerCase());
  if (existing) return existing;
  const created = await model.create({ name: trimmed, isActive: true });
  const id = String(created._id);
  maps.byId.set(id, id);
  maps.byName.set(trimmed.toLowerCase(), id);
  return id;
}

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

  const [branchDocs, groupDocs, batchDocs] = await Promise.all([
    Branch.find().select("name").lean(),
    Group.find().select("name").lean(),
    Batch.find().select("name").lean(),
  ]);
  const branches = indexLookups(branchDocs);
  const groups = indexLookups(groupDocs);
  const batches = indexLookups(batchDocs);

  let skippedExisting = 0;
  const seen = new Set<string>();
  const payloads: ReturnType<typeof studentPayload>[] = [];

  try {
    for (const row of filled) {
      const studentNumber = normalizeStudentNumber(row.studentNumber);
      if (!studentNumber || existingSet.has(studentNumber) || seen.has(studentNumber)) {
        skippedExisting += 1;
        continue;
      }

      const [branch, group, batch] = await Promise.all([
        resolveLookupId(row.branch, branches, Branch),
        resolveLookupId(row.group, groups, Group),
        resolveLookupId(row.batch, batches, Batch),
      ]);

      payloads.push(
        studentPayload({
          roll: row.roll,
          serial: row.serial,
          name: row.name,
          studentNumber,
          guardianPhone: row.guardianPhone,
          branch,
          group,
          batch,
        })
      );
      seen.add(studentNumber);
      existingSet.add(studentNumber);
    }

    if (payloads.length) {
      await Student.insertMany(payloads, { ordered: false });
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
    newValue: { createdStudents: payloads.length, skippedExisting },
  });

  return NextResponse.json({ createdStudents: payloads.length, skippedExisting });
}
