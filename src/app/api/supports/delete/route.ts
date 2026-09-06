import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, withAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { Support } from "@/models/Support";

const schema = z.object({
  supportIds: z.array(z.string()).min(1),
});

export async function POST(request: Request) {
  const { user, error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Select supports to delete");

  const result = await Support.deleteMany({ _id: { $in: parsed.data.supportIds } });
  await logActivity({
    user,
    action: parsed.data.supportIds.length > 1 ? "Deleted supports" : "Deleted support",
    targetType: "support",
    newValue: { count: result.deletedCount, supportIds: parsed.data.supportIds },
  });

  return NextResponse.json({ deleted: result.deletedCount });
}
