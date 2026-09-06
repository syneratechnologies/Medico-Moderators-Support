import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseSearchParams, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { findOrCreateLookup } from "@/lib/lookups";
import { serializeSupport } from "@/lib/serializers";
import { findStudentByNumber, studentPayload } from "@/lib/students";
import { isValidPhone } from "@/lib/utils";
import { Student } from "@/models/Student";
import { Support } from "@/models/Support";
import { SupportType } from "@/models/SupportType";
import { User } from "@/models/User";

const createForStudentSchema = z.object({
  studentId: z.string().optional(),
  studentIds: z.array(z.string()).optional(),
  supportType: z.string().min(1),
  priority: z.enum(["low", "medium", "high"]).optional(),
  moderatorId: z.string().optional(),
}).refine((data) => Boolean(data.studentId || data.studentIds?.length), {
  message: "Select at least one student",
});

const createSchema = z.object({
  roll: z.string().min(1),
  serial: z.string().min(1),
  name: z.string().min(1),
  studentNumber: z.string().min(1),
  guardianPhone: z.string().min(1),
  branch: z.string().min(1),
  group: z.string().min(1),
  batch: z.string().min(1),
  supportType: z.string().min(1),
  description: z.string().optional().default(""),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.string().optional(),
});

const populate = [
  { path: "student", populate: [{ path: "branch" }, { path: "group" }, { path: "batch" }] },
  { path: "supportType" },
  { path: "assignedModerator" },
  { path: "createdBy" },
  { path: "completedBy" },
];

export async function GET(request: Request) {
  const { user, error } = await withAuth();
  if (error) return error;

  const params = parseSearchParams(request.url);
  const q = params.get("q")?.trim() ?? "";
  const status = params.get("status") ?? "";
  const branch = params.get("branch") ?? "";
  const group = params.get("group") ?? "";
  const batch = params.get("batch") ?? "";
  const supportType = params.get("supportType") ?? "";
  const moderator = params.get("moderator") ?? "";
  const unassigned = params.get("unassigned") === "true";
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const limit = Math.min(500, Math.max(10, Number(params.get("limit") ?? 20)));

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (supportType) filter.supportType = supportType;
  if (unassigned) {
    filter.assignedModerator = { $in: [null, undefined] };
    filter.$or = [{ assignedModerator: { $exists: false } }, { assignedModerator: null }];
    delete filter.assignedModerator;
  }
  if (moderator) filter.assignedModerator = moderator;
  if (user.role === "moderator") filter.assignedModerator = user.id;

  let studentIds: string[] | null = null;
  if (q || branch || group || batch) {
    const studentFilter: Record<string, unknown> = {};
    if (branch) studentFilter.branch = branch;
    if (group) studentFilter.group = group;
    if (batch) studentFilter.batch = batch;
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      studentFilter.$or = [
        { name: rx },
        { studentNumber: rx },
        { roll: rx },
        { serial: rx },
        { guardianPhone: rx },
      ];
    }
    const students = await Student.find(studentFilter).select("_id");
    studentIds = students.map((item) => String(item._id));
    filter.student = { $in: studentIds };
  }

  const [items, total] = await Promise.all([
    Support.find(filter)
      .populate(populate)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Support.countDocuments(filter),
  ]);

  return NextResponse.json({
    items: items.map((item) => serializeSupport(item as Record<string, unknown>)),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

export async function POST(request: Request) {
  const { user, error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;

  const body = await request.json().catch(() => null);
  const forStudent = createForStudentSchema.safeParse(body);
  if (forStudent.success) {
    const studentIds = [...new Set([
      ...(forStudent.data.studentIds ?? []),
      ...(forStudent.data.studentId ? [forStudent.data.studentId] : []),
    ])];
    const students = await Student.find({ _id: { $in: studentIds } });
    if (!students.length) return jsonError("Student not found", 404);
    if (students.length !== studentIds.length) return jsonError("One or more students were not found", 404);

    const supportType = await findOrCreateLookup(SupportType, forStudent.data.supportType);
    const moderator = forStudent.data.moderatorId
      ? await User.findById(forStudent.data.moderatorId)
      : null;
    if (forStudent.data.moderatorId && (!moderator || moderator.role !== "moderator" || !moderator.isActive)) {
      return jsonError("Active moderator not found");
    }

    const created = [];
    for (const student of students) {
      const support = await Support.create({
        student: student._id,
        supportType: supportType._id,
        createdBy: user.id,
        status: "pending",
        priority: forStudent.data.priority ?? "medium",
        ...(moderator
          ? {
              assignedModerator: moderator._id,
              assignedBy: user.id,
              assignedAt: new Date(),
            }
          : {}),
      });
      await support.populate(populate);
      created.push(serializeSupport(support.toObject() as Record<string, unknown>));
    }

    await logActivity({
      user,
      action: created.length > 1 ? "Created supports for selected students" : "Created support",
      targetType: "support",
      targetId: created[0]?.id,
      newValue: {
        count: created.length,
        studentIds,
        assigned: Boolean(forStudent.data.moderatorId),
      },
    });
    return NextResponse.json({
      support: created[0],
      supports: created,
      createdCount: created.length,
      createdStudent: false,
    });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError("Required support fields are missing");
  if (!isValidPhone(parsed.data.guardianPhone)) return jsonError("Invalid guardian phone");

  let student = await findStudentByNumber(parsed.data.studentNumber);
  let createdStudent = false;
  if (!student) {
    student = await Student.create(studentPayload(parsed.data));
    createdStudent = true;
  }

  const supportType = await findOrCreateLookup(SupportType, parsed.data.supportType);
  const support = await Support.create({
    student: student._id,
    supportType: supportType._id,
    createdBy: user.id,
    status: "pending",
    priority: parsed.data.priority ?? "medium",
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
  });

  await support.populate(populate);
  await logActivity({
    user,
    action: createdStudent ? "Created student and support" : "Created support",
    targetType: "support",
    targetId: String(support._id),
    newValue: {
      studentNumber: student.studentNumber,
      existingStudent: !createdStudent,
    },
  });

  return NextResponse.json({
    support: serializeSupport(support.toObject() as Record<string, unknown>),
    createdStudent,
  });
}
