import { Student } from "@/models/Student";
import { normalizePhone, normalizeStudentNumber } from "./utils";

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
  const byNumber = await findStudentByNumber(payload.studentNumber);
  const byId =
    input.studentId && /^[a-f0-9]{24}$/i.test(input.studentId)
      ? await Student.findById(input.studentId)
      : null;
  const student = byNumber ?? byId;

  if (!student) {
    const created = await Student.create(payload);
    return { student: created, created: true };
  }

  student.roll = payload.roll;
  student.serial = payload.serial;
  student.name = payload.name;
  student.guardianPhone = payload.guardianPhone;
  student.branch = payload.branch as unknown as typeof student.branch;
  student.group = payload.group as unknown as typeof student.group;
  student.batch = payload.batch as unknown as typeof student.batch;

  const taken = await Student.findOne({
    studentNumber: payload.studentNumber,
    _id: { $ne: student._id },
  });
  if (!taken) {
    student.studentNumber = payload.studentNumber;
  }

  await student.save();
  return { student, created: false };
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
    roll: input.roll.trim(),
    serial: input.serial.trim(),
    name: input.name.trim(),
    studentNumber: normalizeStudentNumber(input.studentNumber),
    guardianPhone: normalizePhone(input.guardianPhone),
    branch: input.branch,
    group: input.group,
    batch: input.batch,
  };
}
