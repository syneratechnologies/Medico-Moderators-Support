import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseSearchParams, withAuth } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { managerCanMutateUser } from "@/lib/permissions";
import { serializeUser } from "@/lib/serializers";
import { User } from "@/models/User";

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .refine((value) => value.includes("@"), "Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["super_admin", "manager", "moderator"]),
  phone: z.string().optional(),
});

export async function GET(request: Request) {
  const { user, error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;

  const params = parseSearchParams(request.url);
  const role = params.get("role") ?? "";
  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;
  if (user.role === "manager") filter.role = "moderator";

  const users = await User.find(filter).sort({ createdAt: -1 }).lean();
  return NextResponse.json(users.map((item) => serializeUser(item as Record<string, unknown>)));
}

export async function POST(request: Request) {
  const { user, error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Name, email, password and role are required");
  }
  if (!managerCanMutateUser(user.role, parsed.data.role)) {
    return jsonError("You cannot create this role", 403);
  }

  const exists = await User.findOne({ email: parsed.data.email.toLowerCase() });
  if (exists) return jsonError("Email already exists", 409);

  const created = await User.create({
    name: parsed.data.name.trim(),
    email: parsed.data.email.toLowerCase(),
    passwordHash: await hashPassword(parsed.data.password),
    role: parsed.data.role,
    phone: parsed.data.phone ?? "",
    isActive: true,
    createdBy: user.id,
  });

  await logActivity({
    user,
    action: `Created ${parsed.data.role}`,
    targetType: "user",
    targetId: String(created._id),
    newValue: { name: created.name, email: created.email, role: created.role },
  });

  return NextResponse.json(serializeUser(created.toObject() as Record<string, unknown>));
}
