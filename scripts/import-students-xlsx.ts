import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import mongoose from "mongoose";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    const raw = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (!match) continue;
      process.env[match[1].trim()] ??= match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();

const SUPPORT_TYPE = "Guardian Call";
const DEFAULT_PASSWORD = "123456";
const BRANCH_ALIASES: Record<string, string> = {
  chattogram: "Chittagong",
  kushtia: "Kustia",
};

function cellText(row: ExcelJS.Row, col: number) {
  const cell = row.getCell(col);
  return (cell.text?.trim() || String(cell.value ?? "")).trim();
}

function isPlaceholder(value: string) {
  const trimmed = value.trim();
  return !trimmed || trimmed === "0000" || trimmed === "-" || trimmed.toLowerCase() === "n/a";
}

function normalizePersonName(value: string) {
  return value
    .toLowerCase()
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanBranchName(value: string) {
  if (isPlaceholder(value)) return "";
  let name = value.replace(/\s+branch$/i, "").trim();
  const alias = BRANCH_ALIASES[name.toLowerCase()];
  if (alias) name = alias;
  return name;
}

function emailFromName(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return `${slug || "moderator"}@medico.local`;
}

type NamedMaps = {
  byId: Map<string, string>;
  byName: Map<string, string>;
};

function indexNamed(docs: Array<{ _id: unknown; name: string }>): NamedMaps {
  const byId = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const doc of docs) {
    const id = String(doc._id);
    byId.set(id, id);
    byName.set(doc.name.trim().toLowerCase(), id);
  }
  return { byId, byName };
}

async function resolveNamed(
  value: string,
  maps: NamedMaps,
  model: { create: (doc: { name: string; isActive: boolean }) => Promise<{ _id: unknown; name: string }> }
) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const existing = maps.byId.get(trimmed) ?? maps.byName.get(trimmed.toLowerCase());
  if (existing) return existing;
  const created = await model.create({ name: trimmed, isActive: true });
  const id = String(created._id);
  maps.byId.set(id, id);
  maps.byName.set(trimmed.toLowerCase(), id);
  return id;
}

async function main() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("MONGODB_URI is missing in .env.local");

  const filePath = resolve(process.cwd(), "Students.xlsx");
  if (!existsSync(filePath)) throw new Error("Students.xlsx not found in project root");

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Students.xlsx has no worksheet");

  const parsed: Array<{
    roll: string;
    serial: string;
    name: string;
    studentNumber: string;
    guardianPhone: string;
    branch: string;
    group: string;
    batch: string;
    moderator: string;
  }> = [];
  const seenRolls = new Set<string>();
  let skippedDuplicates = 0;
  let skippedBlank = 0;

  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const roll = cellText(row, 1).trim();
    const serialRaw = cellText(row, 2);
    const name = cellText(row, 3);
    const studentNumber = cellText(row, 4);
    const guardianPhone = cellText(row, 5);
    const branch = cleanBranchName(cellText(row, 6));
    const groupRaw = cellText(row, 7);
    const batchRaw = cellText(row, 8);
    const moderator = cellText(row, 9);
    if (!roll && !name && !moderator) {
      skippedBlank += 1;
      return;
    }
    if (!roll) {
      skippedBlank += 1;
      return;
    }
    if (seenRolls.has(roll)) {
      skippedDuplicates += 1;
      return;
    }
    seenRolls.add(roll);
    parsed.push({
      roll,
      serial: isPlaceholder(serialRaw) ? "" : serialRaw,
      name,
      studentNumber,
      guardianPhone,
      branch,
      group: isPlaceholder(groupRaw) ? "" : groupRaw,
      batch: isPlaceholder(batchRaw) ? "" : batchRaw,
      moderator,
    });
  });

  const {
    Batch,
  } = await import("../src/models/Batch");
  const { Branch } = await import("../src/models/Branch");
  const { Group } = await import("../src/models/Group");
  const { Student } = await import("../src/models/Student");
  const { Support } = await import("../src/models/Support");
  const { SupportType } = await import("../src/models/SupportType");
  const { User } = await import("../src/models/User");
  const { studentPayload } = await import("../src/lib/students");

  await mongoose.connect(uri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 20000,
    family: 4,
  });

  const [branchDocs, groupDocs, batchDocs, supportTypeDocs, moderatorDocs, admin] = await Promise.all([
    Branch.find().select("name").lean(),
    Group.find().select("name").lean(),
    Batch.find().select("name").lean(),
    SupportType.find().select("name").lean(),
    User.find({ role: "moderator" }).select("name email isActive").lean(),
    User.findOne({ role: "super_admin" }).select("_id").lean(),
  ]);
  if (!admin) throw new Error("No super admin found. Run npm run push-needed first.");

  const branches = indexNamed(branchDocs);
  const groups = indexNamed(groupDocs);
  const batches = indexNamed(batchDocs);
  const supportTypes = indexNamed(supportTypeDocs);
  const supportTypeId = await resolveNamed(SUPPORT_TYPE, supportTypes, SupportType);
  if (!supportTypeId) throw new Error("Could not resolve support type");

  const moderatorsByName = new Map<string, { id: string; name: string }>();
  for (const mod of moderatorDocs) {
    const key = normalizePersonName(String(mod.name ?? ""));
    if (key) moderatorsByName.set(key, { id: String(mod._id), name: String(mod.name) });
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  let moderatorsCreated = 0;
  const missingNames = [...new Set(parsed.map((row) => row.moderator).filter(Boolean))].filter(
    (name) => !moderatorsByName.has(normalizePersonName(name))
  );

  for (const name of missingNames) {
    const email = emailFromName(name);
    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.role !== "moderator") {
        throw new Error(`Email ${email} already belongs to a non-moderator`);
      }
      existing.name = name;
      existing.isActive = true;
      await existing.save();
      moderatorsByName.set(normalizePersonName(name), { id: String(existing._id), name });
      continue;
    }
    const created = await User.create({
      name,
      email,
      passwordHash,
      role: "moderator",
      isActive: true,
      phone: "",
    });
    moderatorsByName.set(normalizePersonName(name), { id: String(created._id), name });
    moderatorsCreated += 1;
    console.log(`Created moderator: ${name} <${email}>`);
  }

  const rolls = parsed.map((row) => row.roll);
  const existingStudents = await Student.find({ roll: { $in: rolls } }).select("_id roll");
  const studentByRoll = new Map(existingStudents.map((item) => [String(item.roll), String(item._id)]));

  const studentPayloads: ReturnType<typeof studentPayload>[] = [];
  const supportPlan: Array<{ roll: string; moderatorId: string }> = [];
  let skippedNoModerator = 0;

  for (const row of parsed) {
    const moderator = row.moderator ? moderatorsByName.get(normalizePersonName(row.moderator)) : null;
    if (!moderator) {
      skippedNoModerator += 1;
      continue;
    }

    const [branch, group, batch] = await Promise.all([
      resolveNamed(row.branch, branches, Branch),
      resolveNamed(row.group, groups, Group),
      resolveNamed(row.batch, batches, Batch),
    ]);

    if (!studentByRoll.has(row.roll)) {
      studentPayloads.push(
        studentPayload({
          roll: row.roll,
          serial: row.serial,
          name: row.name,
          studentNumber: row.studentNumber,
          guardianPhone: row.guardianPhone,
          branch: branch ?? "",
          group: group ?? "",
          batch: batch ?? "",
        })
      );
    }
    supportPlan.push({ roll: row.roll, moderatorId: moderator.id });
  }

  let createdStudents = 0;
  if (studentPayloads.length) {
    const inserted = await Student.insertMany(studentPayloads, { ordered: false });
    createdStudents = inserted.length;
    for (const student of inserted) {
      studentByRoll.set(String(student.roll), String(student._id));
    }
  }

  const studentIds = [...studentByRoll.values()];
  const existingSupports = await Support.find({
    student: { $in: studentIds },
    supportType: supportTypeId,
    status: { $in: ["pending", "in_progress"] },
  })
    .select("student assignedModerator")
    .lean();
  const openKey = new Set(
    existingSupports.map(
      (item) => `${String(item.student)}:${item.assignedModerator ? String(item.assignedModerator) : ""}`
    )
  );

  const supportDocs: Array<{
    student: string;
    supportType: string;
    createdBy: string;
    status: "pending";
    priority: "medium";
    assignedModerator: string;
    assignedBy: string;
    assignedAt: Date;
  }> = [];
  let skippedExistingSupport = 0;
  let skippedMissingStudent = 0;

  for (const item of supportPlan) {
    const studentId = studentByRoll.get(item.roll);
    if (!studentId) {
      skippedMissingStudent += 1;
      continue;
    }
    const key = `${studentId}:${item.moderatorId}`;
    if (openKey.has(key)) {
      skippedExistingSupport += 1;
      continue;
    }
    openKey.add(key);
    supportDocs.push({
      student: studentId,
      supportType: supportTypeId,
      createdBy: String(admin._id),
      status: "pending",
      priority: "medium",
      assignedModerator: item.moderatorId,
      assignedBy: String(admin._id),
      assignedAt: new Date(),
    });
  }

  let createdSupports = 0;
  const chunkSize = 500;
  for (let i = 0; i < supportDocs.length; i += chunkSize) {
    const chunk = supportDocs.slice(i, i + chunkSize);
    const inserted = await Support.insertMany(chunk, { ordered: false });
    createdSupports += inserted.length;
  }

  console.log("Imported Students.xlsx");
  console.log(`Rows used          ${parsed.length} unique rolls`);
  console.log(`Skipped duplicate  ${skippedDuplicates}`);
  console.log(`Skipped blank      ${skippedBlank}`);
  console.log(`Students created   ${createdStudents}`);
  console.log(`Students existing  ${parsed.length - createdStudents - skippedNoModerator}`);
  console.log(`Supports created   ${createdSupports}`);
  console.log(`Supports skipped   ${skippedExistingSupport} already open for same moderator`);
  console.log(`Moderators created ${moderatorsCreated}`);
  if (skippedNoModerator) console.log(`Skipped no moderator ${skippedNoModerator}`);
  if (skippedMissingStudent) console.log(`Skipped missing student ${skippedMissingStudent}`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
