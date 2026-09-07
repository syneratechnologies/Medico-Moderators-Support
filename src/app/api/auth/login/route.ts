import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { User } from "@/models/User";

const schema = z.object({
  email: z.string().min(3),
  password: z.string().min(1),
});

function findUserQuery(identifier: string) {
  const value = identifier.trim();
  if (value.includes("@")) {
    return { email: value.toLowerCase() };
  }
  return { phone: value.replace(/\s+/g, "") };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email or phone and password are required" }, { status: 400 });
  }

  try {
    await connectDb();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database connection failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    const user = await User.findOne(findUserQuery(parsed.data.email));
    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const session = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
    };
    const token = await createSessionToken(session);
    await setSessionCookie(token);

    return NextResponse.json({ user: session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
