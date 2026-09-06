import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { serializeStudent, serializeSupport } from "@/lib/serializers";
import { studentPayload } from "@/lib/students";
import { isValidPhone } from "@/lib/utils";
import { Student } from "@/models/Student";
import { Support } from "@/models/Support";

const updateSchema = z.object({
  roll: z.string().min(1),
  serial: z.string().min(1),
  name: z.string().min(1),
  studentNumber: z.string().min(1),
  guardianPhone: z.string().min(1),
  branch: z.string().min(1),
  group: z.string().min(1),
  batch: z.string().min(1),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await withAuth();
  if (error) return error;
  const { id } = await context.params;

  const student = await Student.findById(id).populate("branch group batch").lean();
  if (!student) return jsonError("Student not found", 404);

  if (user.role === "moderator") {
    const assigned = await Support.exists({ student: id, assignedModerator: user.id });
    if (!assigned) return jsonError("Forbidden", 403);
  }

  const historyFilter: Record<string, unknown> = { student: id };
  if (user.role === "moderator") {
    // Moderators can see lifetime history of assigned students
  }

  const supports = await Support.find(historyFilter)
    .populate("supportType assignedModerator createdBy completedBy")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({
    student: serializeStudent(student as Record<string, unknown>),
    supports: supports.map((item) => serializeSupport(item as Record<string, unknown>)),
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;
  const { id } = await context.params;

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("All student fields are required");
  if (!isValidPhone(parsed.data.guardianPhone)) return jsonError("Invalid guardian phone");

  const student = await Student.findById(id);
  if (!student) return jsonError("Student not found", 404);

  const duplicate = await Student.findOne({
    studentNumber: parsed.data.studentNumber.trim().toUpperCase(),
    _id: { $ne: id },
  });
  if (duplicate) return jsonError("Student number already exists", 409);

  const previous = {
    name: student.name,
    studentNumber: student.studentNumber,
    roll: student.roll,
  };

  Object.assign(student, studentPayload(parsed.data));
  await student.save();
  await student.populate("branch group batch");

  await logActivity({
    user,
    action: "Edited student",
    targetType: "student",
    targetId: id,
    previousValue: previous,
    newValue: { name: student.name, studentNumber: student.studentNumber, roll: student.roll },
  });

  return NextResponse.json(serializeStudent(student.toObject() as Record<string, unknown>));
}
