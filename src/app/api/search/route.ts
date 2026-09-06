import { NextResponse } from "next/server";
import { parseSearchParams, withAuth } from "@/lib/api";
import { escapeRegex } from "@/lib/lookups";
import { serializeStudent, serializeSupport } from "@/lib/serializers";
import { Student } from "@/models/Student";
import { Support } from "@/models/Support";

export async function GET(request: Request) {
  const { user, error } = await withAuth();
  if (error) return error;

  const q = parseSearchParams(request.url).get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ students: [], supports: [] });

  const rx = new RegExp(escapeRegex(q), "i");
  const studentFilter: Record<string, unknown> = {
    $or: [{ name: rx }, { studentNumber: rx }, { roll: rx }, { serial: rx }, { guardianPhone: rx }],
  };

  if (user.role === "moderator") {
    const assigned = await Support.find({ assignedModerator: user.id }).distinct("student");
    studentFilter._id = { $in: assigned };
  }

  const students = await Student.find(studentFilter).populate("branch group batch").limit(8).lean();
  const studentIds = students.map((item) => item._id);

  const supportFilter: Record<string, unknown> = {
    $or: [{ description: rx }, { student: { $in: studentIds } }],
  };
  if (user.role === "moderator") supportFilter.assignedModerator = user.id;

  const supports = await Support.find(supportFilter)
    .populate("student supportType assignedModerator")
    .limit(8)
    .lean();

  return NextResponse.json({
    students: students.map((item) => serializeStudent(item as Record<string, unknown>)),
    supports: supports.map((item) => serializeSupport(item as Record<string, unknown>)),
  });
}
