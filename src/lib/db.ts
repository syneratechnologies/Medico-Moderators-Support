import { setDefaultResultOrder, setServers } from "node:dns";
import path from "path";
import mongoose from "mongoose";
import { cleanupBlankSupports } from "./cleanup-supports";
import { seedDemoData } from "./seed-data";

try {
  setDefaultResultOrder("ipv4first");
  setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // Windows / restricted environments may ignore custom DNS
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  seeded: boolean;
  cleaned: boolean;
}

const globalWithMongoose = globalThis as typeof globalThis & {
  mongooseCache?: MongooseCache;
  mongoMemory?: { getUri: () => string };
};

const cache: MongooseCache = globalWithMongoose.mongooseCache ?? {
  conn: null,
  promise: null,
  seeded: false,
  cleaned: false,
};

if (!globalWithMongoose.mongooseCache) {
  globalWithMongoose.mongooseCache = cache;
}

async function localUri() {
  if (!globalWithMongoose.mongoMemory) {
    console.info("Atlas unavailable. Starting local embedded MongoDB…");
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    globalWithMongoose.mongoMemory = await MongoMemoryServer.create({
      instance: {
        dbName: "medico-support",
        dbPath: path.join(process.cwd(), ".data", "mongo"),
        storageEngine: "wiredTiger",
      },
    });
  }
  return globalWithMongoose.mongoMemory.getUri();
}

async function resolveUri() {
  const configured = process.env.MONGODB_URI?.trim();
  if (configured) return configured;
  return localUri();
}

async function openConnection(uri: string) {
  return mongoose.connect(uri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 12000,
    family: 4,
  });
}

async function afterConnect() {
  if (!cache.seeded) {
    cache.seeded = true;
    const created = await seedDemoData();
    if (created) console.info("Demo accounts seeded: admin@medico.local / Medico@123");
  }
  if (!cache.cleaned) {
    cache.cleaned = true;
    const removed = await cleanupBlankSupports();
    if (removed) console.info(`Removed ${removed} blank/orphan support(s)`);
  }
}

export async function connectDb() {
  if (cache.conn) {
    await afterConnect();
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = (async () => {
      const uri = await resolveUri();
      try {
        return await openConnection(uri);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (uri.startsWith("mongodb+srv://") || message.includes("querySrv") || message.includes("ECONNREFUSED") || message.includes("Server selection timed out")) {
          console.warn(`Mongo connection failed (${message}). Falling back to local database.`);
          return openConnection(await localUri());
        }
        throw error;
      }
    })().catch((error) => {
      cache.promise = null;
      throw error;
    });
  }

  cache.conn = await cache.promise;
  await afterConnect();
  return cache.conn;
}
