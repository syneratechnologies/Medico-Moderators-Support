import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { serializeSupport } from "@/lib/serializers";
import { Support } from "@/models/Support";

const schema = z.object({
  outcome: z.string().trim().min(1, "Comment is required"),
});

const populate =
  "student supportType assignedModerator createdBy completedBy student.branch student.group student.batch";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await withAuth();
  if (error) return error;
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Comment cannot be empty");

  const support = await Support.findById(id);
  if (!support) return jsonError("Support not found", 404);

  if (user.role === "moderator") {
    if (String(support.assignedModerator ?? "") !== user.id) {
      return jsonError("Forbidden", 403);
    }
  } else if (user.role !== "super_admin" && user.role !== "manager") {
    return jsonError("Forbidden", 403);
  }

  const previous = support.outcome;
  support.outcome = parsed.data.outcome;
  if (support.description == null) support.description = "";
  await support.save();
  await support.populate(populate);

  await logActivity({
    user,
    action: "Edited support comment",
    targetType: "support",
    targetId: id,
    previousValue: { outcome: previous },
    newValue: { outcome: support.outcome },
  });

  return NextResponse.json(serializeSupport(support.toObject() as Record<string, unknown>));
}
