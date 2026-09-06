import { NextResponse } from "next/server";
import { parseSearchParams, withAuth } from "@/lib/api";
import { ActivityLog } from "@/models/ActivityLog";

export async function GET(request: Request) {
  const { user, error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;

  const params = parseSearchParams(request.url);
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const limit = 30;
  const filter = user.role === "manager" ? { user: user.id } : {};

  const [items, total] = await Promise.all([
    ActivityLog.find(filter)
      .populate("user")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ActivityLog.countDocuments(filter),
  ]);

  return NextResponse.json({
    items: items.map((item) => ({
      id: String(item._id),
      action: item.action,
      targetType: item.targetType,
      targetId: item.targetId ? String(item.targetId) : "",
      previousValue: item.previousValue,
      newValue: item.newValue,
      createdAt: item.createdAt,
      user: (() => {
        const populated = item.user as unknown as { _id?: unknown; name?: string } | null;
        if (populated && typeof populated === "object" && populated.name) {
          return { id: String(populated._id ?? ""), name: populated.name };
        }
        return { id: "", name: "Unknown" };
      })(),
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}
