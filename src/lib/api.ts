import { NextResponse } from "next/server";
import { getSession } from "./auth";
import { connectDb } from "./db";
import type { Role, SessionUser } from "./types";

type AuthOk = { user: SessionUser; error?: never };
type AuthFail = { user: null; error: NextResponse };

export async function withAuth(roles?: Role[]): Promise<AuthOk | AuthFail> {
  await connectDb();
  const user = await getSession();
  if (!user) {
    return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (roles && !roles.includes(user.role)) {
    return { user: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function parseSearchParams(url: string) {
  return new URL(url).searchParams;
}
