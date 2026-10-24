
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const { id: idParam } = await context.params;
    const id = Number(idParam);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid duration ID." },
        { status: 400 }
      );
    }

    let body: { days?: unknown; isActive?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }

    const data: { days?: number; isActive?: boolean } = {};

    if (Object.prototype.hasOwnProperty.call(body, "days")) {
      const days = Number(body.days);

      if (!Number.isSafeInteger(days) || days <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Number of days must be a positive whole number.",
          },
          { status: 400 }
        );
      }

      data.days = days;
    }

    if (Object.prototype.hasOwnProperty.call(body, "isActive")) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json(
          {
            success: false,
            message: "isActive must be true or false.",
          },
          { status: 400 }
        );
      }

      data.isActive = body.isActive;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No changes were provided.",
        },
        { status: 400 }
      );
    }

    const duration = await prisma.hotelStayDuration.update({
      where: { id },
      data,
    });

    await writeAuditLog({
      userId,
      module: "SERVICE_SETTINGS",
      action: "UPDATE",
      entity: "HotelStayDuration",
      entityId: String(duration.id),
      description: `Updated hotel stay duration to ${duration.days} days.`,
      metadata: data,
    });

    return NextResponse.json({
      success: true,
      message: "Hotel stay duration updated successfully.",
      duration,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "This number of days already exists.",
        },
        { status: 409 }
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { success: false, message: "Stay duration not found." },
        { status: 404 }
      );
    }

    console.error("Hotel stay duration PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update hotel stay duration.",
      },
      { status: 500 }
    );
  }
}
