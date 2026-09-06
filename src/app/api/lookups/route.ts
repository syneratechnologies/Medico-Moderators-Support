import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, jsonError } from "@/lib/api";
import { getLookups } from "@/lib/lookups";
import { Branch } from "@/models/Branch";
import { Group } from "@/models/Group";
import { Batch } from "@/models/Batch";
import { SupportType } from "@/models/SupportType";
import { logActivity } from "@/lib/activity";

const createSchema = z.object({
  kind: z.enum(["branch", "group", "batch", "supportType"]),
  name: z.string().min(1),
});

export async function GET() {
  const { error } = await withAuth();
  if (error) return error;
  return NextResponse.json(await getLookups());
}

export async function POST(request: Request) {
  const { user, error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid lookup payload");

  const models = {
    branch: Branch,
    group: Group,
    batch: Batch,
    supportType: SupportType,
  };
  const Model = models[parsed.data.kind];
  const existing = await Model.findOne({ name: new RegExp(`^${parsed.data.name.trim()}$`, "i") });
  if (existing) return jsonError("This name already exists");

  const created = await Model.create({ name: parsed.data.name.trim(), isActive: true });
  await logActivity({
    user,
    action: `Created ${parsed.data.kind}`,
    targetType: parsed.data.kind,
    targetId: String(created._id),
    newValue: { name: created.name },
  });

  return NextResponse.json({ id: String(created._id), name: created.name, kind: parsed.data.kind });
}
