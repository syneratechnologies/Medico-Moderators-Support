import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { serializeSupport } from "@/lib/serializers";
import { persistComments } from "@/lib/support-comments";
import { Support } from "@/models/Support";

const schema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  outcome: z.string().optional(),
});

const populate = [
  { path: "student", populate: [{ path: "branch" }, { path: "group" }, { path: "batch" }] },
  { path: "supportType" },
  { path: "assignedModerator" },
  { path: "createdBy" },
  { path: "completedBy" },
  { path: "comments.createdBy" },
];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, error } = await withAuth();
  if (error) return error;
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid status update");

  const support = await Support.findById(id);
  if (!support) return jsonError("Support not found", 404);

  if (user.role === "moderator") {
    if (String(support.assignedModerator ?? "") !== user.id) {
      return jsonError("Forbidden", 403);
    }
    if (parsed.data.status === "cancelled") {
      return jsonError("Moderators cannot cancel supports");
    }
  }

  persistComments(support);
  const note = parsed.data.outcome?.trim() ?? "";

  if (parsed.data.status === "completed") {
    if (!note && !String(support.outcome ?? "").trim()) {
      return jsonError("Outcome / note is mandatory before completing support");
    }
    if (note) {
      const last = support.comments?.[support.comments.length - 1];
      if (!last || last.text.trim() !== note) {
        support.comments = support.comments ?? [];
        support.comments.push({
          text: note,
          createdBy: user.id as never,
          createdAt: new Date(),
        });
      }
      support.outcome = note;
    }
    support.completedAt = new Date();
    support.completedBy = user.id as never;
  }

  if (parsed.data.status === "in_progress" && note) {
    const last = support.comments?.[support.comments.length - 1];
    if (!last || last.text.trim() !== note) {
      support.comments = support.comments ?? [];
      support.comments.push({
        text: note,
        createdBy: user.id as never,
        createdAt: new Date(),
      });
    }
    support.outcome = note;
  }

  const previous = support.status;
  support.status = parsed.data.status;
  if (support.description == null) support.description = "";
  await support.save();
  await support.populate(populate);

  await logActivity({
    user,
    action:
      parsed.data.status === "completed"
        ? "Completed support"
        : parsed.data.status === "in_progress"
          ? "Started support"
          : `Updated support status to ${parsed.data.status}`,
    targetType: "support",
    targetId: id,
    previousValue: { status: previous },
    newValue: { status: support.status, outcome: support.outcome },
  });

  return NextResponse.json(serializeSupport(support.toObject() as Record<string, unknown>));
}
