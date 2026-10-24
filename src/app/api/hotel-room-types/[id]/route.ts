
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
        { success: false, message: "Invalid room type ID." },
        { status: 400 }
      );
    }

    let body: { name?: unknown; isActive?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }

    const data: { name?: string; isActive?: boolean } = {};

    if (Object.prototype.hasOwnProperty.call(body, "name")) {
      const name =
        typeof body.name === "string" ? body.name.trim() : "";

      if (!name || name.length > 100) {
        return NextResponse.json(
          {
            success: false,
            message: "Room type name is required and must be 100 characters or fewer.",
          },
          { status: 400 }
        );
      }

      data.name = name;
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

    const roomType = await prisma.hotelRoomType.update({
      where: { id },
      data,
    });

    await writeAuditLog({
      userId,
      module: "SERVICE_SETTINGS",
      action: "UPDATE",
      entity: "HotelRoomType",
      entityId: String(roomType.id),
      description: `Updated hotel room type "${roomType.name}".`,
      metadata: data,
    });

    return NextResponse.json({
      success: true,
      message: "Hotel room type updated successfully.",
      roomType,
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
          message: "This room type already exists.",
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
        { success: false, message: "Room type not found." },
        { status: 404 }
      );
    }

    console.error("Hotel room type PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update hotel room type.",
      },
      { status: 500 }
    );
  }
}
