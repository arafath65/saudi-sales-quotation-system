import { NextResponse } from "next/server";

import {
  getSessionUserId,
  SESSION_COOKIE,
} from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST() {
  const userId = await getSessionUserId();

  try {
    if (userId) {
      await writeAuditLog({
        userId,
        module: "AUTH",
        action: "LOGOUT",
        entity: "User",
        entityId: String(userId),
        description: "User logged out.",
      });
    }

    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully.",
    });

    response.cookies.set({
      name: SESSION_COOKIE,
      value: "",
      httpOnly: true,
      expires: new Date(0),
      sameSite: "lax",
      secure:
        process.env.NODE_ENV === "production",
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Logout error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to process logout.",
      },
      { status: 500 }
    );
  }
}