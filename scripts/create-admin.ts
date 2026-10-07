import "dotenv/config";

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import bcrypt from "bcryptjs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";

function getEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

async function main() {
  const adapter = new PrismaMariaDb({
    host: getEnv("DATABASE_HOST"),
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: getEnv("DATABASE_USER"),
    password: process.env.DATABASE_PASSWORD ?? "",
    database: getEnv("DATABASE_NAME"),
    connectionLimit: 5,
  });

  const prisma = new PrismaClient({ adapter });

  const rl = readline.createInterface({
    input,
    output,
  });

  try {
    console.log("\n=== Create Admin User ===\n");

    const name = (await rl.question("Admin name: ")).trim();
    const username = (await rl.question("Admin username: ")).trim();
    const password = await rl.question("Admin password: ");

    if (!name) {
      throw new Error("Admin name is required.");
    }

    if (!username) {
      throw new Error("Admin username is required.");
    }

    if (!password) {
      throw new Error("Admin password is required.");
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        username,
      },
    });

    if (existingUser) {
      throw new Error(`Username "${username}" already exists.`);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        username,
        passwordHash,
        role: "ADMIN",
        isActive: true,
      },
    });

    console.log("\n✓ Admin user created successfully.");
    console.log(`  ID:       ${user.id}`);
    console.log(`  Name:     ${user.name}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Role:     ${user.role}\n`);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    "\n✗ Failed to create admin:",
    error instanceof Error ? error.message : error
  );

  process.exit(1);
});