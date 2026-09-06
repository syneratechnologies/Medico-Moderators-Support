import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import mongoose from "mongoose";
import { seedDemoData } from "../src/lib/seed-data";
import { User } from "../src/models/User";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (!match) continue;
      process.env[match[1].trim()] ??= match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();

async function seed() {
  const { connectDb } = await import("../src/lib/db");
  await connectDb();
  await Promise.all([
    User.deleteMany({}),
    (await import("../src/models/Student")).Student.deleteMany({}),
    (await import("../src/models/Support")).Support.deleteMany({}),
    (await import("../src/models/Branch")).Branch.deleteMany({}),
    (await import("../src/models/Group")).Group.deleteMany({}),
    (await import("../src/models/Batch")).Batch.deleteMany({}),
    (await import("../src/models/SupportType")).SupportType.deleteMany({}),
  ]);
  await seedDemoData();
  console.log("Seed complete.");
  console.log("Admin      admin@medico.local / Medico@123");
  console.log("Manager    manager@medico.local / Medico@123");
  console.log("Moderator  moderator.a@medico.local / Medico@123");
  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
