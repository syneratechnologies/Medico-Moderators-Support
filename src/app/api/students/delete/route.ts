import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { Student } from "@/models/Student";
import { Support } from "@/models/Support";

const schema = z.object({
  studentIds: z.array(z.string()).min(1),
});

export async function POST(request: Request) {
  const { user, error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Select students to delete");

  const studentIds = [...new Set(parsed.data.studentIds)];
  const supports = await Support.deleteMany({ student: { $in: studentIds } });
  const students = await Student.deleteMany({ _id: { $in: studentIds } });

  await logActivity({
    user,
    action: studentIds.length > 1 ? "Deleted students" : "Deleted student",
    targetType: "student",
    newValue: {
      count: students.deletedCount,
      supportCount: supports.deletedCount,
      studentIds,
    },
  });

  return NextResponse.json({
    deleted: students.deletedCount,
    deletedSupports: supports.deletedCount,
  });
}
