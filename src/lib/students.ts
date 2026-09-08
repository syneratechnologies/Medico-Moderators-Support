import { Student } from "@/models/Student";
import { normalizePhone, normalizeRoll, normalizeStudentNumber } from "./utils";

export async function findStudentByRoll(roll: string) {
  const value = normalizeRoll(roll);
  if (!value) return null;
  return Student.findOne({ roll: value });
}

export async function findStudentByNumber(studentNumber: string) {
  const value = normalizeStudentNumber(studentNumber);
  if (!value) return null;
  return Student.findOne({ studentNumber: value });
}

export async function resolveStudent(input: {
  studentId?: string;
  roll: string;
  serial: string;
  name: string;
  studentNumber: string;
  guardianPhone: string;
  branch: string;
  group: string;
  batch: string;
}) {
  const payload = studentPayload(input);
  const byId =
    input.studentId && /^[a-f0-9]{24}$/i.test(input.studentId)
      ? await Student.findById(input.studentId)
      : null;
  if (byId) return { student: byId, created: false };

  const byRoll = await findStudentByRoll(payload.roll);
  if (byRoll) return { student: byRoll, created: false };

  const created = await Student.create(payload);
  return { student: created, created: true };
}

export function studentPayload(input: {
  roll: string;
  serial: string;
  name: string;
  studentNumber: string;
  guardianPhone: string;
  branch: string;
  group: string;
  batch: string;
}) {
  return {
    roll: normalizeRoll(input.roll),
    serial: input.serial.trim(),
    name: input.name.trim(),
    studentNumber: normalizeStudentNumber(input.studentNumber),
    guardianPhone: input.guardianPhone.trim() ? normalizePhone(input.guardianPhone) : "",
    ...(input.branch.trim() ? { branch: input.branch.trim() } : {}),
    ...(input.group.trim() ? { group: input.group.trim() } : {}),
    ...(input.batch.trim() ? { batch: input.batch.trim() } : {}),
  };
}

export async function ensureStudentIdentityIndexes() {
  const collection = Student.collection;
  try {
    await collection.dropIndex("studentNumber_1");
  } catch {
    // Index may already be gone
  }
  try {
    await collection.dropIndex("roll_1");
  } catch {
    // Replaced by roll_unique
  }
  try {
    await collection.createIndex(
      { roll: 1 },
      {
        unique: true,
        name: "roll_unique",
        partialFilterExpression: { roll: { $gt: "" } },
      }
    );
  } catch {
    // Index may already exist
  }
}
