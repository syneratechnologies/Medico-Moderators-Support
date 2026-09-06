import { Batch } from "@/models/Batch";
import { Branch } from "@/models/Branch";
import { Group } from "@/models/Group";
import { SupportType } from "@/models/SupportType";

export async function resolveLookup(
  model: typeof Branch | typeof Group | typeof Batch | typeof SupportType,
  value: string
) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.match(/^[a-f0-9]{24}$/i)) {
    const byId = await model.findById(trimmed);
    if (byId) return byId;
  }
  const byName = await model.findOne({ name: new RegExp(`^${escapeRegex(trimmed)}$`, "i") });
  return byName;
}

export async function findOrCreateLookup(
  model: typeof Branch | typeof Group | typeof Batch | typeof SupportType,
  value: string
) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Branch, group, batch and support type cannot be empty");
  }
  const existing = await resolveLookup(model, trimmed);
  if (existing) return existing;
  return model.create({ name: trimmed, isActive: true });
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getLookups() {
  const [branches, groups, batches, supportTypes] = await Promise.all([
    Branch.find({ isActive: true }).sort({ name: 1 }).lean(),
    Group.find({ isActive: true }).sort({ name: 1 }).lean(),
    Batch.find({ isActive: true }).sort({ name: 1 }).lean(),
    SupportType.find({ isActive: true }).sort({ name: 1 }).lean(),
  ]);

  return {
    branches: branches.map((item) => ({ id: String(item._id), name: item.name })),
    groups: groups.map((item) => ({ id: String(item._id), name: item.name })),
    batches: batches.map((item) => ({ id: String(item._id), name: item.name })),
    supportTypes: supportTypes.map((item) => ({ id: String(item._id), name: item.name })),
  };
}
