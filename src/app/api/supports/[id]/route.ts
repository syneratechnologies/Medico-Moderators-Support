import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { serializeSupport } from "@/lib/serializers";
import { Support } from "@/models/Support";

const updateSchema = z.object({
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.string().nullable().optional(),
  supportType: z.string().optional(),
});

const populate = [
  { path: "student", populate: [{ path: "branch" }, { path: "group" }, { path: "batch" }] },
  { path: "supportType" },
  { path: "assignedModerator" },
  { path: "createdBy" },
  { path: "completedBy" },
];

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await withAuth();
  if (error) return error;
  const { id } = await context.params;

  const support = await Support.findById(id).populate(populate).lean();
  if (!support) return jsonError("Support not found", 404);

  if (user.role === "moderator" && String(support.assignedModerator) !== user.id) {
    const assignedId =
      support.assignedModerator && typeof support.assignedModerator === "object"
        ? String((support.assignedModerator as { _id: unknown })._id)
        : String(support.assignedModerator ?? "");
    if (assignedId !== user.id) return jsonError("Forbidden", 403);
  }

  return NextResponse.json(serializeSupport(support as Record<string, unknown>));
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;
  const { id } = await context.params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid support update");

  const support = await Support.findById(id);
  if (!support) return jsonError("Support not found", 404);

  if (parsed.data.description !== undefined) support.description = parsed.data.description;
  if (support.description == null) support.description = "";
  if (parsed.data.priority) support.priority = parsed.data.priority;
  if (parsed.data.supportType) support.supportType = parsed.data.supportType as never;
  if (parsed.data.dueDate !== undefined) {
    support.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined;
  }
  await support.save();
  await support.populate(populate);

  await logActivity({
    user,
    action: "Edited support",
    targetType: "support",
    targetId: id,
    newValue: parsed.data,
  });

  return NextResponse.json(serializeSupport(support.toObject() as Record<string, unknown>));
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;
  const { id } = await context.params;
  const support = await Support.findByIdAndDelete(id);
  if (!support) return jsonError("Support not found", 404);
  await logActivity({
    user,
    action: "Deleted support",
    targetType: "support",
    targetId: id,
  });
  return NextResponse.json({ ok: true });
}
