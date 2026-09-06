import type { Role, SessionUser } from "./types";

export function canManageUsers(role: Role) {
  return role === "super_admin" || role === "manager";
}

export function canCreateSupport(role: Role) {
  return role === "super_admin" || role === "manager";
}

export function canAssignSupport(role: Role) {
  return role === "super_admin" || role === "manager";
}

export function canManageLookups(role: Role) {
  return role === "super_admin" || role === "manager";
}

export function canViewAllActivity(role: Role) {
  return role === "super_admin";
}

export function canManageManagers(role: Role) {
  return role === "super_admin";
}

export function canEditStudent(role: Role) {
  return role === "super_admin" || role === "manager";
}

export function canDeleteSupport(role: Role) {
  return role === "super_admin" || role === "manager";
}

export function assertRole(user: SessionUser | null, roles: Role[]) {
  if (!user) {
    const error = new Error("Unauthorized");
    (error as Error & { status: number }).status = 401;
    throw error;
  }
  if (!roles.includes(user.role)) {
    const error = new Error("Forbidden");
    (error as Error & { status: number }).status = 403;
    throw error;
  }
}

export function managerCanMutateUser(actorRole: Role, targetRole: Role) {
  if (actorRole === "super_admin") return true;
  if (actorRole === "manager") return targetRole === "moderator";
  return false;
}

export const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: "LayoutDashboard" | "GraduationCap" | "Headset" | "CirclePlus" | "FileSpreadsheet" | "UserPlus" | "UserCheck" | "Users" | "Settings2" | "ScrollText";
  roles: Role[];
}> = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", roles: ["super_admin", "manager", "moderator"] },
  { href: "/students", label: "Students", icon: "GraduationCap", roles: ["super_admin", "manager", "moderator"] },
  { href: "/my-supports", label: "Supports", icon: "Headset", roles: ["moderator"] },
  { href: "/supports", label: "Import", icon: "FileSpreadsheet", roles: ["super_admin", "manager"] },
  { href: "/moderators", label: "Moderators", icon: "UserCheck", roles: ["super_admin", "manager"] },
  { href: "/users", label: "Team", icon: "Users", roles: ["super_admin", "manager"] },
  { href: "/settings", label: "Catalog", icon: "Settings2", roles: ["super_admin", "manager"] },
  { href: "/activity", label: "Activity Log", icon: "ScrollText", roles: ["super_admin", "manager"] },
];
