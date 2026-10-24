
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

    const durations = await prisma.hotelStayDuration.findMany({
      orderBy: { days: "asc" },
    });

    return NextResponse.json({
      success: true,
      durations,
    });
  } catch (error) {
    console.error("Hotel stay durations GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load hotel stay durations.",
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

    let body: { days?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }

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

    const duration = await prisma.hotelStayDuration.create({
      data: { days },
    });

    await writeAuditLog({
      userId,
      module: "SERVICE_SETTINGS",
      action: "CREATE",
      entity: "HotelStayDuration",
      entityId: String(duration.id),
      description: `Created hotel stay duration of ${duration.days} days.`,
      metadata: { days: duration.days },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Hotel stay duration created successfully.",
        duration,
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
          message: "This number of days already exists.",
        },
        { status: 409 }
      );
    }

    console.error("Hotel stay duration POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create hotel stay duration.",
      },
      { status: 500 }
    );
  }
}
