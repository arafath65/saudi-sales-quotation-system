import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import {
  createSessionValue,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  let username = "";

  try {
    const body = await request.json();

    username =
      typeof body.username === "string"
        ? body.username.trim()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!username || !password) {
      await writeAuditLog({
        module: "AUTH",
        action: "LOGIN_FAILED",
        entity: "User",
        description:
          "Login attempt failed because username or password was missing.",
        metadata: {
          username: username || null,
          reason: "MISSING_CREDENTIALS",
        },
      });

      return NextResponse.json(
        {
          success: false,
          message:
            "Username and password are required.",
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        username,
      },
    });

    if (!user || !user.isActive) {
      await writeAuditLog({
        module: "AUTH",
        action: "LOGIN_FAILED",
        entity: "User",
        description:
          "Login attempt failed because the user was not found or inactive.",
        metadata: {
          username,
          reason: "INVALID_USER",
        },
      });

      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid username or password.",
        },
        { status: 401 }
      );
    }

    const passwordValid =
      await bcrypt.compare(
        password,
        user.passwordHash
      );

    if (!passwordValid) {
      await writeAuditLog({
        module: "AUTH",
        action: "LOGIN_FAILED",
        entity: "User",
        entityId: String(user.id),
        description:
          `Failed login attempt for user ${user.username}.`,
        metadata: {
          username,
          reason: "INVALID_PASSWORD",
        },
      });

      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid username or password.",
        },
        { status: 401 }
      );
    }

    await writeAuditLog({
      userId: user.id,
      module: "AUTH",
      action: "LOGIN",
      entity: "User",
      entityId: String(user.id),
      description:
        `User ${user.username} logged in successfully.`,
      metadata: {
        username: user.username,
        role: user.role,
      },
    });

    const response = NextResponse.json({
      success: true,
      message: "Login successful.",
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE,
      value: createSessionValue(user.id),
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV === "production",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);

    await writeAuditLog({
      module: "AUTH",
      action: "LOGIN_ERROR",
      entity: "User",
      description:
        "Unexpected error occurred during login.",
      metadata: {
        username: username || null,
      },
    });

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to process login.",
      },
      { status: 500 }
    );
  }
}