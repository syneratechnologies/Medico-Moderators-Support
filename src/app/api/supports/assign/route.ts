import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { User } from "@/models/User";
import { Support } from "@/models/Support";

const schema = z.object({
  supportIds: z.array(z.string()).min(1),
  moderatorId: z.string(),
  reopenCompleted: z.boolean().optional(),
});

export async function POST(request: Request) {
  const { user, error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Select supports and a moderator");

  if (!parsed.data.moderatorId) {
    const result = await Support.updateMany(
      { _id: { $in: parsed.data.supportIds } },
      { $unset: { assignedModerator: 1, assignedBy: 1, assignedAt: 1 } }
    );
    await logActivity({
      user,
      action: "Unassigned supports",
      targetType: "support",
      newValue: { count: result.modifiedCount, supportIds: parsed.data.supportIds },
    });
    return NextResponse.json({ assigned: result.modifiedCount, moderator: null });
  }

  const moderator = await User.findById(parsed.data.moderatorId);
  if (!moderator || moderator.role !== "moderator" || !moderator.isActive) {
    return jsonError("Active moderator not found");
  }

  const previous = await Support.find({ _id: { $in: parsed.data.supportIds } })
    .select("assignedModerator")
    .populate("assignedModerator")
    .lean();

  const result = await Support.updateMany(
    { _id: { $in: parsed.data.supportIds } },
    {
      $set: {
        assignedModerator: moderator._id,
        assignedBy: user.id,
        assignedAt: new Date(),
      },
    }
  );

  if (parsed.data.reopenCompleted) {
    await Support.updateMany(
      { _id: { $in: parsed.data.supportIds }, status: { $in: ["completed", "cancelled"] } },
      { $set: { status: "pending" }, $unset: { completedAt: 1, completedBy: 1 } }
    );
  }

  await logActivity({
    user,
    action: parsed.data.supportIds.length > 1 ? "Reassigned supports" : "Assigned support",
    targetType: "support",
    previousValue: {
      moderators: previous.map((item) =>
        item.assignedModerator && typeof item.assignedModerator === "object"
          ? (item.assignedModerator as { name?: string }).name
          : "Unassigned"
      ),
    },
    newValue: {
      count: result.modifiedCount,
      moderator: moderator.name,
      supportIds: parsed.data.supportIds,
    },
  });

  return NextResponse.json({
    assigned: result.modifiedCount,
    moderator: { id: String(moderator._id), name: moderator.name },
  });
}
