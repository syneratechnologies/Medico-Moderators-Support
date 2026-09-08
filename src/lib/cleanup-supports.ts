import { Student } from "@/models/Student";
import { Support } from "@/models/Support";

export async function cleanupBlankSupports() {
  const supports = await Support.find().select("student").lean();
  if (!supports.length) return 0;

  const studentIds = [...new Set(supports.map((item) => String(item.student ?? "")).filter(Boolean))];
  const students = await Student.find({ _id: { $in: studentIds } })
    .select("_id name studentNumber roll")
    .lean();
  const byId = new Map(students.map((item) => [String(item._id), item]));

  const orphanIds = supports
    .filter((item) => {
      const student = byId.get(String(item.student ?? ""));
      if (!student) return true;
      const name = String(student.name ?? "").trim();
      const roll = String(student.roll ?? "").trim();
      const number = String(student.studentNumber ?? "").trim();
      return !name && !roll && !number;
    })
    .map((item) => item._id);

  if (!orphanIds.length) return 0;
  await Support.deleteMany({ _id: { $in: orphanIds } });
  return orphanIds.length;
}
