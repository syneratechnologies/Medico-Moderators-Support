import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, withAuth } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { managerCanMutateUser } from "@/lib/permissions";
import { serializeUser } from "@/lib/serializers";
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

  const [pending, inProgress, completed, cancelled, total] = await Promise.all([
    Support.countDocuments({ assignedModerator: id, status: "pending" }),
    Support.countDocuments({ assignedModerator: id, status: "in_progress" }),
    Support.countDocuments({ assignedModerator: id, status: "completed" }),
    Support.countDocuments({ assignedModerator: id, status: "cancelled" }),
    Support.countDocuments({ assignedModerator: id }),
  ]);

  return NextResponse.json({
    user: serializeUser(target as Record<string, unknown>),
    stats: { total, pending, inProgress, completed, cancelled },
  });
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;
  const { id } = await context.params;

  const target = await User.findById(id);
  if (!target) return jsonError("User not found", 404);
  if (!managerCanMutateUser(user.role, target.role)) {
    return jsonError("You cannot manage this account", 403);
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid user update");

  const previous = { name: target.name, isActive: target.isActive };
  if (parsed.data.name) target.name = parsed.data.name;
  if (parsed.data.phone !== undefined) target.phone = parsed.data.phone;
  if (parsed.data.isActive !== undefined) target.isActive = parsed.data.isActive;
  if (parsed.data.password) target.passwordHash = await hashPassword(parsed.data.password);
  await target.save();

  await logActivity({
    user,
    action: parsed.data.isActive === false ? "Disabled user" : "Updated user",
    targetType: "user",
    targetId: id,
    previousValue: previous,
    newValue: { name: target.name, isActive: target.isActive },
  });

  return NextResponse.json(serializeUser(target.toObject() as Record<string, unknown>));
}
