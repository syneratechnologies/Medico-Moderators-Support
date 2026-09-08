import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, jsonError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { escapeRegex, getLookups, LOOKUP_MODELS, type LookupKind } from "@/lib/lookups";
import { Student } from "@/models/Student";
import { Support } from "@/models/Support";

const kindSchema = z.enum(["branch", "group", "batch", "supportType"]);
const createSchema = z.object({
  kind: kindSchema,
  name: z.string().min(1),
});
const updateSchema = z.object({
  kind: kindSchema,
  id: z.string().min(1),
  name: z.string().min(1),
});
const deleteSchema = z.object({
  kind: kindSchema,
  id: z.string().min(1),
});

const studentField: Record<Exclude<LookupKind, "supportType">, "branch" | "group" | "batch"> = {
  branch: "branch",
  group: "group",
  batch: "batch",
};

async function nameTaken(kind: LookupKind, name: string, exceptId?: string) {
  const Model = LOOKUP_MODELS[kind];
  return Model.findOne({
    name: new RegExp(`^${escapeRegex(name)}$`, "i"),
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  });
}

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

  const name = parsed.data.name.trim();
  if (await nameTaken(parsed.data.kind, name)) return jsonError("This name already exists");

  const created = await LOOKUP_MODELS[parsed.data.kind].create({ name, isActive: true });
  await logActivity({
    user,
    action: `Created ${parsed.data.kind}`,
    targetType: parsed.data.kind,
    targetId: String(created._id),
    newValue: { name: created.name },
  });

  return NextResponse.json({ id: String(created._id), name: created.name, kind: parsed.data.kind });
}

export async function PATCH(request: Request) {
  const { user, error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid lookup update");

  const name = parsed.data.name.trim();
  const item = await LOOKUP_MODELS[parsed.data.kind].findById(parsed.data.id);
  if (!item) return jsonError("Item not found", 404);
  if (await nameTaken(parsed.data.kind, name, parsed.data.id)) return jsonError("This name already exists");

  const previous = item.name;
  item.name = name;
  await item.save();

  await logActivity({
    user,
    action: `Updated ${parsed.data.kind}`,
    targetType: parsed.data.kind,
    targetId: parsed.data.id,
    previousValue: { name: previous },
    newValue: { name },
  });

  return NextResponse.json({ id: parsed.data.id, name, kind: parsed.data.kind });
}

export async function DELETE(request: Request) {
  const { user, error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;

  const params = new URL(request.url).searchParams;
  const parsed = deleteSchema.safeParse({
    kind: params.get("kind"),
    id: params.get("id"),
  });
  if (!parsed.success) return jsonError("Invalid lookup delete");

  const { kind, id } = parsed.data;
  const item = await LOOKUP_MODELS[kind].findById(id);
  if (!item) return jsonError("Item not found", 404);

  let unlinked = 0;
  if (kind === "supportType") {
    const inUse = await Support.countDocuments({ supportType: id });
    if (inUse) {
      return jsonError(`Cannot delete: ${inUse} support${inUse === 1 ? "" : "s"} still use this type`);
    }
  } else {
    const field = studentField[kind];
    const result = await Student.updateMany({ [field]: id }, { $unset: { [field]: 1 } });
    unlinked = result.modifiedCount;
  }

  await LOOKUP_MODELS[kind].findByIdAndDelete(id);
  await logActivity({
    user,
    action: `Deleted ${kind}`,
    targetType: kind,
    targetId: id,
    previousValue: { name: item.name },
    newValue: { unlinked },
  });

  return NextResponse.json({ ok: true, unlinked });
}
