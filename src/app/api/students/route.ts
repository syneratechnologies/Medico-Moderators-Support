import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseSearchParams, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { escapeRegex } from "@/lib/lookups";
import { serializeStudent } from "@/lib/serializers";
import { findStudentByRoll, studentPayload } from "@/lib/students";
import { isValidPhone } from "@/lib/utils";
import { Student } from "@/models/Student";
import { Support } from "@/models/Support";

const createSchema = z.object({
  roll: z.string().min(1),
  serial: z.string().min(1),
  name: z.string().min(1),
  studentNumber: z.string().min(1),
  guardianPhone: z.string().min(1),
  branch: z.string().min(1),
  group: z.string().min(1),
  batch: z.string().min(1),
});

export async function GET(request: Request) {
  const { user, error } = await withAuth();
  if (error) return error;

  const params = parseSearchParams(request.url);
  const q = params.get("q")?.trim() ?? "";
  const branch = params.get("branch") ?? "";
  const group = params.get("group") ?? "";
  const batch = params.get("batch") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const limit = Math.min(200, Math.max(10, Number(params.get("limit") ?? 50)));

  const filter: Record<string, unknown> = {};
  if (branch) filter.branch = branch;
  if (group) filter.group = group;
  if (batch) filter.batch = batch;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [
      { name: rx },
      { studentNumber: rx },
      { roll: rx },
      { serial: rx },
      { guardianPhone: rx },
    ];
  }

  if (user.role === "moderator") {
    const assigned = await Support.find({ assignedModerator: user.id }).distinct("student");
    filter._id = { $in: assigned };
  }

  const [items, total] = await Promise.all([
    Student.find(filter)
      .populate("branch group batch")
      .sort({ roll: 1, name: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Student.countDocuments(filter),
  ]);

  const studentIds = items.map((item) => item._id);
  const activeCounts = studentIds.length
    ? await Support.aggregate<{ _id: unknown; count: number }>([
        {
          $match: {
            student: { $in: studentIds },
            status: { $in: ["pending", "in_progress"] },
          },
        },
        { $group: { _id: "$student", count: { $sum: 1 } } },
      ])
    : [];
  const activeByStudent = new Map(activeCounts.map((item) => [String(item._id), item.count]));

  return NextResponse.json({
    items: items.map((item) => ({
      ...serializeStudent(item as Record<string, unknown>),
      activeSupports: activeByStudent.get(String(item._id)) ?? 0,
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

export async function POST(request: Request) {
  const { user, error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("All student fields are required");
  if (!isValidPhone(parsed.data.guardianPhone)) return jsonError("Invalid guardian phone");

  const existing = await findStudentByRoll(parsed.data.roll);
  if (existing) return jsonError("A student with this roll already exists", 409);

  const student = await Student.create(studentPayload(parsed.data));
  await student.populate("branch group batch");
  await logActivity({
    user,
    action: "Created student",
    targetType: "student",
    targetId: String(student._id),
    newValue: { name: student.name, studentNumber: student.studentNumber },
  });

  return NextResponse.json(serializeStudent(student.toObject() as Record<string, unknown>));
}
