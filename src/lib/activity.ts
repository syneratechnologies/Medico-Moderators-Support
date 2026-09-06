import { ActivityLog } from "@/models/ActivityLog";
import type { SessionUser } from "./types";

export async function logActivity(input: {
  user: SessionUser;
  action: string;
  targetType: string;
  targetId?: string;
  previousValue?: unknown;
  newValue?: unknown;
}) {
  await ActivityLog.create({
    user: input.user.id,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    previousValue: input.previousValue,
    newValue: input.newValue,
  });
}
