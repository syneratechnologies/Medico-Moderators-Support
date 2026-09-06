import bcrypt from "bcryptjs";
import { Batch } from "@/models/Batch";
import { Branch } from "@/models/Branch";
import { Group } from "@/models/Group";
import { Student } from "@/models/Student";
import { Support } from "@/models/Support";
import { SupportType } from "@/models/SupportType";
import { User } from "@/models/User";

export async function seedDemoData() {
  const existing = await User.countDocuments();
  if (existing > 0) return false;

  const passwordHash = await bcrypt.hash("Medico@123", 12);

  const [admin, manager, ...moderators] = await User.create([
    { name: "Super Admin", email: "admin@medico.local", passwordHash, role: "super_admin", isActive: true },
    { name: "Nabila Rahman", email: "manager@medico.local", passwordHash, role: "manager", isActive: true },
    { name: "Moderator A", email: "moderator.a@medico.local", passwordHash, role: "moderator", isActive: true },
    { name: "Moderator B", email: "moderator.b@medico.local", passwordHash, role: "moderator", isActive: true },
    { name: "Moderator C", email: "moderator.c@medico.local", passwordHash, role: "moderator", isActive: true },
  ]);

  const [dhaka, chittagong, sylhet] = await Branch.create([
    { name: "Dhaka" },
    { name: "Chittagong" },
    { name: "Sylhet" },
  ]);
  const [groupA, groupB] = await Group.create([{ name: "A" }, { name: "B" }]);
  const [batch2026, batch2025] = await Batch.create([{ name: "2026" }, { name: "2025" }]);
  const [guardianCall, documents, payment, appointment] = await SupportType.create([
    { name: "Guardian Call" },
    { name: "Document Collection" },
    { name: "Payment Follow-up" },
    { name: "Appointment" },
  ]);

  const students = await Student.create([
    {
      roll: "101",
      serial: "S001",
      name: "Rahim Ahmed",
      studentNumber: "ST1001",
      guardianPhone: "01711111111",
      branch: dhaka._id,
      group: groupA._id,
      batch: batch2026._id,
    },
    {
      roll: "102",
      serial: "S002",
      name: "Sadia Akter",
      studentNumber: "ST1002",
      guardianPhone: "01722222222",
      branch: dhaka._id,
      group: groupA._id,
      batch: batch2026._id,
    },
    {
      roll: "210",
      serial: "S014",
      name: "Tanvir Hasan",
      studentNumber: "ST1014",
      guardianPhone: "01833333333",
      branch: chittagong._id,
      group: groupB._id,
      batch: batch2025._id,
    },
    {
      roll: "311",
      serial: "S022",
      name: "Maliha Chowdhury",
      studentNumber: "ST1022",
      guardianPhone: "01644444444",
      branch: sylhet._id,
      group: groupA._id,
      batch: batch2026._id,
    },
  ]);

  await Support.create([
    {
      student: students[0]._id,
      supportType: guardianCall._id,
      description: "Guardian-এর সাথে প্রাথমিক যোগাযোগ এবং কোর্স আপডেট দেওয়া।",
      createdBy: manager._id,
      assignedModerator: moderators[0]._id,
      assignedBy: manager._id,
      assignedAt: new Date("2026-09-01"),
      status: "completed",
      priority: "high",
      outcome: "Guardian-এর সাথে যোগাযোগ করা হয়েছে এবং required documents সংগ্রহ করা হয়েছে।",
      completedAt: new Date("2026-09-01"),
      completedBy: moderators[0]._id,
    },
    {
      student: students[0]._id,
      supportType: documents._id,
      description: "Admission documents সংগ্রহ ও verify করতে হবে।",
      createdBy: manager._id,
      assignedModerator: moderators[1]._id,
      assignedBy: manager._id,
      assignedAt: new Date("2026-09-03"),
      status: "completed",
      priority: "medium",
      outcome: "All documents received and verified.",
      completedAt: new Date("2026-09-03"),
      completedBy: moderators[1]._id,
    },
    {
      student: students[0]._id,
      supportType: payment._id,
      description: "Due installment follow-up.",
      createdBy: manager._id,
      assignedModerator: moderators[2]._id,
      assignedBy: manager._id,
      assignedAt: new Date("2026-09-05"),
      status: "pending",
      priority: "high",
      dueDate: new Date("2026-09-08"),
    },
    {
      student: students[1]._id,
      supportType: appointment._id,
      description: "Counseling appointment schedule করতে হবে।",
      createdBy: manager._id,
      assignedModerator: moderators[0]._id,
      assignedBy: manager._id,
      assignedAt: new Date(),
      status: "in_progress",
      priority: "medium",
    },
    {
      student: students[2]._id,
      supportType: guardianCall._id,
      description: "Attendance issue নিয়ে guardian call।",
      createdBy: admin._id,
      status: "pending",
      priority: "medium",
    },
    {
      student: students[3]._id,
      supportType: payment._id,
      description: "Scholarship document follow-up.",
      createdBy: manager._id,
      status: "pending",
      priority: "low",
    },
  ]);

  return true;
}
