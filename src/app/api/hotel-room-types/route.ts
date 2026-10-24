
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const roomTypes = await prisma.hotelRoomType.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      success: true,
      roomTypes,
    });
  } catch (error) {
    console.error("Hotel room types GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load hotel room types.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    let body: { name?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Room type name is required.",
        },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        {
          success: false,
          message: "Room type name cannot exceed 100 characters.",
        },
        { status: 400 }
      );
    }

    const roomType = await prisma.hotelRoomType.create({
      data: { name },
    });

    await writeAuditLog({
      userId,
      module: "SERVICE_SETTINGS",
      action: "CREATE",
      entity: "HotelRoomType",
      entityId: String(roomType.id),
      description: `Created hotel room type "${roomType.name}".`,
      metadata: { name: roomType.name },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Hotel room type created successfully.",
        roomType,
      },
      { status: 201 }
    );
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

    console.error("Hotel room type POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create hotel room type.",
      },
      { status: 500 }
    );
  }
}
