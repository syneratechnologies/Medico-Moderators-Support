export const ROLES = ["super_admin", "manager", "moderator"] as const;
export type Role = (typeof ROLES)[number];

export const SUPPORT_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export const STUDENT_FIELDS = [
  "roll",
  "serial",
  "name",
  "studentNumber",
  "guardianPhone",
  "branch",
  "group",
  "batch",
] as const;

export type StudentField = (typeof STUDENT_FIELDS)[number];
