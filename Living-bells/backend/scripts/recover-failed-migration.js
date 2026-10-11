import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";

const migrationName = "20261010170000_multi_church_foundation";
const prisma = new PrismaClient();

function runPrisma(args) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(command, ["prisma", ...args], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Prisma command failed: prisma ${args.join(" ")}`);
  }
}

try {
  const failedRows = await prisma.$queryRaw`
    SELECT "migration_name"
    FROM "_prisma_migrations"
    WHERE "migration_name" = ${migrationName}
      AND "finished_at" IS NULL
      AND "rolled_back_at" IS NULL
    ORDER BY "started_at" DESC
    LIMIT 1
  `;

  if (failedRows.length > 0) {
    console.log(
      `Found the known failed migration ${migrationName}; marking that failed attempt rolled back so Prisma can retry the corrected SQL.`,
    );
    runPrisma(["migrate", "resolve", "--rolled-back", migrationName]);
  } else {
    console.log(
      `No unresolved failed attempt for ${migrationName}; leaving migration history unchanged.`,
    );
  }
} catch (error) {
  console.error("Failed to inspect/recover the known Prisma migration:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

if (process.exitCode === 1) {
  process.exit(1);
}
