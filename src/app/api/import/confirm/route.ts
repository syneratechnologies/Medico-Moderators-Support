import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { findOrCreateLookup } from "@/lib/lookups";
import { findStudentByRoll, studentPayload } from "@/lib/students";
import { Batch } from "@/models/Batch";
import { Branch } from "@/models/Branch";
import { Group } from "@/models/Group";
import { ImportJob } from "@/models/ImportJob";
import { Support } from "@/models/Support";
import { SupportType } from "@/models/SupportType";

const schema = z.object({ jobId: z.string().min(1) });

export async function POST(request: Request) {
  const { user, error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Import job is required");

  const job = await ImportJob.findById(parsed.data.jobId);
  if (!job || job.status !== "preview") return jsonError("Import preview expired. Upload again.");

  const validRows = (job.rows ?? []).filter((row) => !row.errors?.length);
  let createdStudents = 0;
  let createdSupports = 0;

  for (const row of validRows) {
    const [branch, group, batch, supportType] = await Promise.all([
      findOrCreateLookup(Branch, String(row.branch)),
      findOrCreateLookup(Group, String(row.group)),
      findOrCreateLookup(Batch, String(row.batch)),
      findOrCreateLookup(SupportType, String(row.supportType)),
    ]);

    let student = await findStudentByRoll(String(row.roll));
    if (!student) {
      student = await (await import("@/models/Student")).Student.create(
        studentPayload({
          roll: String(row.roll),
          serial: String(row.serial),
          name: String(row.name),
          studentNumber: String(row.studentNumber),
          guardianPhone: String(row.guardianPhone),
          branch: String(branch._id),
          group: String(group._id),
          batch: String(batch._id),
        })
      );
      createdStudents += 1;
    }

    await Support.create({
      student: student._id,
      supportType: supportType._id,
      createdBy: user.id,
      status: "pending",
      priority: "medium",
    });
    createdSupports += 1;
  }

  job.status = "confirmed";
  await job.save();

  await logActivity({
    user,
    action: "Confirmed Excel import",
    targetType: "import",
    targetId: String(job._id),
    newValue: { createdStudents, createdSupports, fileName: job.fileName },
  });

  return NextResponse.json({ createdStudents, createdSupports });
}
