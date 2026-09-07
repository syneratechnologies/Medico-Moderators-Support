import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import bcrypt from "bcryptjs";
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

const BRANCHES = [
  "Farmgate",
  "Mohammadpur",
  "Shantinagar",
  "Uttara",
  "Mirpur",
  "Jatrabari",
  "English Version",
  "Mymensingh",
  "Rangpur",
  "Dinajpur",
  "Cumilla",
  "Chittagong",
  "Kustia",
  "Sylhet",
  "Bogura",
  "Pabna",
  "Tangail",
  "Faridpur",
  "Khulna",
  "Barisal",
  "Rajshahi",
  "Online Batch",
  "Exam Batch",
  "Dhaka",
];

const BATCHES = [
  "1st Time 2026",
  "Golden Batch Exam",
  "Revision Batch & 10th October GB Batch",
  "Model Test Exam (1st Time - 4th Nov)",
  "Model Test Exam (2nd Time - 4th Nov)",
  "Model Test Exam (1st Time - 9th Nov F, S)",
  "Model Test Exam (1st Time - 9th Nov Except F, S)",
  "Model Test Exam (2nd Time - 9th Nov)",
  "22 August Batch All",
  "2026",
  "2025",
];

const GROUPS = [
  "F01",
  "F02",
  "Mp 01",
  "S01",
  "S02",
  "U01",
  "M01",
  "J01",
  "All EV",
  "Mym01",
  "Rang01",
  "Dj01",
  "Rang02",
  "Cum01",
  "Ch01",
  "Kst01",
  "Sy01",
  "Bg01",
  "Bg02",
  "Pbn01",
  "Tgl01",
  "Fp01",
  "Kh01",
  "Bsl01",
  "Rj01",
  "1st Time All",
  "22 August Batch All",
  "A",
  "B",
];

function parseMentors(md: string) {
  const mentors: Array<{ name: string; phone: string; email: string }> = [];
  for (const line of md.split(/\r?\n/)) {
    const match = line.match(
      /^\|\s*\d+\s*\|\s*([^|]+)\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|/
    );
    if (!match) continue;
    mentors.push({
      name: match[1].trim(),
      phone: match[2].trim(),
      email: match[3].trim().toLowerCase(),
    });
  }
  return mentors;
}

async function upsertNamed(
  model: mongoose.Model<{ name: string; isActive?: boolean }>,
  names: string[]
) {
  let created = 0;
  let existing = 0;
  for (const name of names) {
    const result = await model.updateOne(
      { name },
      { $set: { isActive: true }, $setOnInsert: { name } },
      { upsert: true }
    );
    if (result.upsertedCount) created += 1;
    else existing += 1;
  }
  return { created, existing, total: names.length };
}

async function main() {
  const mdPath = resolve(process.cwd(), "needed users.md");
  if (!existsSync(mdPath)) {
    throw new Error("needed users.md not found in project root");
  }

  const mentors = parseMentors(readFileSync(mdPath, "utf8"));
  if (mentors.length !== 77) {
    throw new Error(`Expected 77 mentors, parsed ${mentors.length}`);
  }

  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is missing in .env.local");
  }

  const { User } = await import("../src/models/User");
  const { Branch } = await import("../src/models/Branch");
  const { Batch } = await import("../src/models/Batch");
  const { Group } = await import("../src/models/Group");

  await mongoose.connect(uri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 20000,
    family: 4,
  });
  const passwordHash = await bcrypt.hash("123456", 12);

  const branches = await upsertNamed(Branch, BRANCHES);
  const batches = await upsertNamed(Batch, BATCHES);
  const groups = await upsertNamed(Group, GROUPS);

  const staff = [
    { name: "Super Admin", email: "admin@medico.local", role: "super_admin" as const, phone: "" },
    { name: "Manager", email: "manager@medico.local", role: "manager" as const, phone: "" },
  ];

  let usersCreated = 0;
  let usersUpdated = 0;

  for (const user of staff) {
    const result = await User.updateOne(
      { email: user.email },
      {
        $set: {
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isActive: true,
          passwordHash,
        },
      },
      { upsert: true }
    );
    if (result.upsertedCount) usersCreated += 1;
    else usersUpdated += 1;
  }

  for (const mentor of mentors) {
    const result = await User.updateOne(
      { email: mentor.email },
      {
        $set: {
          name: mentor.name,
          email: mentor.email,
          phone: mentor.phone,
          role: "moderator",
          isActive: true,
          passwordHash,
        },
      },
      { upsert: true }
    );
    if (result.upsertedCount) usersCreated += 1;
    else usersUpdated += 1;
  }

  const [userCount, branchCount, batchCount, groupCount, moderatorCount] = await Promise.all([
    User.countDocuments(),
    Branch.countDocuments(),
    Batch.countDocuments(),
    Group.countDocuments(),
    User.countDocuments({ role: "moderator", isActive: true }),
  ]);

  console.log("Pushed needed users.md into the database.");
  console.log(`Branches  +${branches.created} new / ${branches.existing} already there  (${branchCount} total)`);
  console.log(`Batches   +${batches.created} new / ${batches.existing} already there  (${batchCount} total)`);
  console.log(`Groups    +${groups.created} new / ${groups.existing} already there  (${groupCount} total)`);
  console.log(`Users     +${usersCreated} new / ${usersUpdated} updated  (${userCount} total, ${moderatorCount} moderators)`);
  console.log("Password for admin, manager, and all mentors: 123456");

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
