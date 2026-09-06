import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { ActivityLog } from "@/models/ActivityLog";
import { Student } from "@/models/Student";
import { Support } from "@/models/Support";
import { User } from "@/models/User";

export async function GET() {
  const { user, error } = await withAuth();
  if (error) return error;

  if (user.role === "moderator") {
    const base = { assignedModerator: user.id };
    const [assigned, pending, inProgress, completed, overdue] = await Promise.all([
      Support.countDocuments(base),
      Support.countDocuments({ ...base, status: "pending" }),
      Support.countDocuments({ ...base, status: "in_progress" }),
      Support.countDocuments({ ...base, status: "completed" }),
      Support.countDocuments({
        ...base,
        status: { $in: ["pending", "in_progress"] },
        dueDate: { $lt: new Date() },
      }),
    ]);
    const recent = await Support.find(base)
      .populate("student supportType")
      .sort({ updatedAt: -1 })
      .limit(8)
      .lean();

    return NextResponse.json({
      role: user.role,
      stats: { assigned, pending, inProgress, completed, overdue },
      recent,
    });
  }

  const [students, supports, pending, inProgress, completed, managers, moderators] = await Promise.all([
    Student.countDocuments(),
    Support.countDocuments(),
    Support.countDocuments({ status: "pending" }),
    Support.countDocuments({ status: "in_progress" }),
    Support.countDocuments({ status: "completed" }),
    User.countDocuments({ role: "manager", isActive: true }),
    User.countDocuments({ role: "moderator", isActive: true }),
  ]);

  const [byType, byBranch, byBatch, performance, activities] = await Promise.all([
    Support.aggregate([
      { $lookup: { from: "supporttypes", localField: "supportType", foreignField: "_id", as: "type" } },
      { $unwind: "$type" },
      { $group: { _id: "$type.name", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
    Support.aggregate([
      { $lookup: { from: "students", localField: "student", foreignField: "_id", as: "student" } },
      { $unwind: "$student" },
      { $lookup: { from: "branches", localField: "student.branch", foreignField: "_id", as: "branch" } },
      { $unwind: "$branch" },
      { $group: { _id: "$branch.name", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Support.aggregate([
      { $lookup: { from: "students", localField: "student", foreignField: "_id", as: "student" } },
      { $unwind: "$student" },
      { $lookup: { from: "batches", localField: "student.batch", foreignField: "_id", as: "batch" } },
      { $unwind: "$batch" },
      { $group: { _id: "$batch.name", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Support.aggregate([
      { $match: { assignedModerator: { $ne: null } } },
      { $group: { _id: "$assignedModerator", completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } }, total: { $sum: 1 } } },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "moderator" } },
      { $unwind: "$moderator" },
      { $project: { name: "$moderator.name", completed: 1, total: 1 } },
      { $sort: { completed: -1 } },
      { $limit: 6 },
    ]),
    ActivityLog.find()
      .populate("user")
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
  ]);

  return NextResponse.json({
    role: user.role,
    stats: { students, supports, pending, inProgress, completed, managers, moderators },
    charts: { byType, byBranch, byBatch, performance },
    activities,
  });
}
