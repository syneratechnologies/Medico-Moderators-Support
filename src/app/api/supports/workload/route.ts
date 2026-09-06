import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { Support } from "@/models/Support";
import { User } from "@/models/User";

export async function GET() {
  const { error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;

  const moderators = await User.find({ role: "moderator", isActive: true }).sort({ name: 1 }).lean();
  const ids = moderators.map((item) => item._id);

  const grouped = await Support.aggregate([
    {
      $group: {
        _id: "$assignedModerator",
        total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
      },
    },
  ]);

  const byId = new Map(grouped.map((item) => [item._id ? String(item._id) : "", item]));

  const unassigned = byId.get("") ?? { total: 0, pending: 0, inProgress: 0, completed: 0 };

  return NextResponse.json({
    unassigned: {
      id: "",
      name: "Unassigned",
      total: unassigned.total,
      pending: unassigned.pending,
      inProgress: unassigned.inProgress,
      completed: unassigned.completed,
    },
    moderators: moderators.map((item) => {
      const stats = byId.get(String(item._id)) ?? { total: 0, pending: 0, inProgress: 0, completed: 0 };
      return {
        id: String(item._id),
        name: item.name,
        email: item.email,
        total: stats.total,
        pending: stats.pending,
        inProgress: stats.inProgress,
        completed: stats.completed,
      };
    }),
  });
}
