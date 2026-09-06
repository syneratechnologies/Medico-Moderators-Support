import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";

export async function GET() {
  const { user, error } = await withAuth();
  if (error) return error;
  return NextResponse.json({ user });
}
