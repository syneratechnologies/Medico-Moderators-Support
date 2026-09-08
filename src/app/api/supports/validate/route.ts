import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, withAuth } from "@/lib/api";
import { isBlankRow, validateSheetRow } from "@/lib/sheet";
import { normalizeRoll } from "@/lib/utils";
import { Student } from "@/models/Student";

const schema = z.object({
  rows: z.array(
    z.object({
      id: z.string(),
      roll: z.string().optional().default(""),
      serial: z.string().optional().default(""),
      name: z.string().optional().default(""),
      studentNumber: z.string().optional().default(""),
      guardianPhone: z.string().optional().default(""),
      branch: z.string().optional().default(""),
      group: z.string().optional().default(""),
      batch: z.string().optional().default(""),
      supportType: z.string().optional().default(""),
      description: z.string().optional().default(""),
      priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
    })
  ),
});

export async function POST(request: Request) {
  const { error } = await withAuth(["super_admin", "manager"]);
  if (error) return error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid sheet rows");

  const rolls = parsed.data.rows.map((row) => normalizeRoll(row.roll ?? "")).filter(Boolean);
  const existing = await Student.find({ roll: { $in: rolls } }).select("roll");
  const existingSet = new Set(existing.map((item) => String(item.roll ?? "")).filter(Boolean));

  const rows = parsed.data.rows.map((row) => {
    if (isBlankRow(row)) {
      return { ...row, errors: [] as string[], isExistingStudent: false };
    }
    const result = validateSheetRow(row, existingSet);
    return {
      ...row,
      studentNumber: result.studentNumber || row.studentNumber,
      roll: result.roll || row.roll,
      errors: result.errors,
      isExistingStudent: result.isExistingStudent,
    };
  });

  return NextResponse.json({ rows });
}
