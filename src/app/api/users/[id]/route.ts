import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, withAuth } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { managerCanMutateUser } from "@/lib/permissions";
import { serializeUser } from "@/lib/serializers";
import { Student } from "@/models/Student";
import { Support } from "@/models/Support";
import { User } from "@/models/User";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;
  const { id } = await context.params;

  const target = await User.findById(id).lean();
  if (!target) return jsonError("User not found", 404);
  if (user.role === "manager" && target.role !== "moderator") {
    return jsonError("Forbidden", 403);
  }

  const [pending, inProgress, completed, cancelled, total, assigned, deleteDocs] = await Promise.all([
    Support.countDocuments({ assignedModerator: id, status: "pending" }),
    Support.countDocuments({ assignedModerator: id, status: "in_progress" }),
    Support.countDocuments({ assignedModerator: id, status: "completed" }),
    Support.countDocuments({ assignedModerator: id, status: "cancelled" }),
    Support.countDocuments({ assignedModerator: id }),
    Support.find({ assignedModerator: id }).select("student").lean(),
    Support.find({ assignedModerator: id, "comments.deleteStatus": "pending" })
      .populate("student supportType comments.createdBy comments.deleteRequestedBy")
      .sort({ updatedAt: -1 })
      .lean(),
  ]);

  const studentIds = [...new Set(assigned.map((item) => String(item.student)).filter(Boolean))];
  const students = studentIds.length
    ? await Student.find({ _id: { $in: studentIds } })
        .populate("branch group batch")
        .select("branch group batch")
        .lean()
    : [];

  function tally(key: "branch" | "group" | "batch") {
    const counts = new Map<string, number>();
    for (const student of students) {
      const ref = student[key] as { name?: string } | undefined;
      const name = ref?.name?.trim() || "Unassigned";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }

  const commentDeletes = deleteDocs.flatMap((support) => {
    const student = support.student as { _id?: unknown; name?: string } | undefined;
    const supportType = support.supportType as { name?: string } | undefined;
    return ((support.comments ?? []) as unknown as Array<Record<string, unknown>>)
      .filter((item) => item.deleteStatus === "pending")
      .map((item) => ({
        supportId: String(support._id),
        commentId: String(item._id),
        text: String(item.text ?? ""),
        requestedAt: item.deleteRequestedAt ?? null,
        requestedBy: {
          id: String((item.deleteRequestedBy as { _id?: unknown })?._id ?? item.deleteRequestedBy ?? ""),
          name:
            typeof item.deleteRequestedBy === "object" && item.deleteRequestedBy && "name" in item.deleteRequestedBy
              ? String((item.deleteRequestedBy as { name?: string }).name)
              : "Moderator",
        },
        student: {
          id: String(student?._id ?? support.student ?? ""),
          name: student?.name ?? "Student",
        },
        supportType: supportType?.name ?? "Support",
      }));
  });

  return NextResponse.json({
    user: serializeUser(target as Record<string, unknown>),
    stats: { total, pending, inProgress, completed, cancelled, students: studentIds.length },
    placement: {
      branches: tally("branch"),
      groups: tally("group"),
      batches: tally("batch"),
    },
    commentDeletes,
  });
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await withAuth();
  if (error) return error;
  const { id } = await context.params;

  const target = await User.findById(id);
  if (!target) return jsonError("User not found", 404);

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid user update");

  const isSelf = user.id === id;
  const canManage = managerCanMutateUser(user.role, target.role);
  const onlyPassword =
    parsed.data.password !== undefined &&
    parsed.data.name === undefined &&
    parsed.data.phone === undefined &&
    parsed.data.isActive === undefined;

  if (parsed.data.password) {
    if (!isSelf && !canManage) return jsonError("You cannot change this password", 403);
  }
  if (parsed.data.name || parsed.data.phone !== undefined || parsed.data.isActive !== undefined) {
    if (!canManage) return jsonError("You cannot manage this account", 403);
  }
  if (!parsed.data.password && !canManage) {
    return jsonError("You cannot manage this account", 403);
  }
  if (!canManage && !onlyPassword) {
    return jsonError("You can only change your own password", 403);
  }

  const previous = { name: target.name, isActive: target.isActive };
  if (parsed.data.name) target.name = parsed.data.name;
  if (parsed.data.phone !== undefined) target.phone = parsed.data.phone;
  if (parsed.data.isActive !== undefined) target.isActive = parsed.data.isActive;
  if (parsed.data.password) target.passwordHash = await hashPassword(parsed.data.password);
  await target.save();

  await logActivity({
    user,
    action: parsed.data.password
      ? isSelf
        ? "Changed own password"
        : "Changed user password"
      : parsed.data.isActive === false
        ? "Disabled user"
        : "Updated user",
    targetType: "user",
    targetId: id,
    previousValue: previous,
    newValue: { name: target.name, isActive: target.isActive },
  });

  return NextResponse.json(serializeUser(target.toObject() as Record<string, unknown>));
}
