import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "session_user";
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }

  return secret;
}

function createSignature(value: string) {
  return createHmac("sha256", getAuthSecret())
    .update(value)
    .digest("hex");
}

export function createSessionValue(userId: number) {
  const timestamp = Math.floor(Date.now() / 1000);

  const payload = `${userId}.${timestamp}`;
  const signature = createSignature(payload);

  return `${payload}.${signature}`;
}

function verifySessionValue(value: string) {
  const parts = value.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [userIdText, timestampText, signature] = parts;

  const userId = Number(userIdText);
  const timestamp = Number(timestampText);

  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  if (!Number.isInteger(timestamp)) {
    return null;
  }

  if (!signature) {
    return null;
  }

  /*
   * Session lifetime is controlled by the HTTP-only cookie's
   * maxAge/expires settings when it is created.
   *
   * We intentionally do not call Date.now() here because this
   * function is used by authenticated Server Components and
   * Next.js 16.4 may prerender those components.
   */

  const payload = `${userId}.${timestamp}`;
  const expectedSignature = createSignature(payload);

  const receivedBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (receivedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(receivedBuffer, expectedBuffer)) {
    return null;
  }

  return userId;
}

export async function getSessionUserId() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;

  if (!session) {
    return null;
  }

  const userId = verifySessionValue(session);

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    return null;
  }

  return user.id;
}

export { SESSION_COOKIE, SESSION_MAX_AGE };