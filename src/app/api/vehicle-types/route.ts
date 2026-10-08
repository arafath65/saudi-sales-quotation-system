import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

async function getUser() {
  const userId =
    await getSessionUserId();

  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      role: true,
      isActive: true,
    },
  });
}

export async function GET() {
  try {
    const user =
      await getUser();

    if (!user || !user.isActive) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const vehicleTypes =
      await prisma.vehicleType.findMany({
        orderBy: [
          {
            isActive: "desc",
          },
          {
            name: "asc",
          },
        ],
      });

    await writeAuditLog({
      userId: user.id,
      module: "VEHICLE_TYPE",
      action: "LIST",
      entity: "VehicleType",
      description:
        "Viewed vehicle types.",
      metadata: {
        resultCount:
          vehicleTypes.length,
      },
    });

    return NextResponse.json({
      success: true,
      vehicleTypes,
    });
  } catch (error) {
    console.error(
      "Vehicle types GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to load vehicle types.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const user =
      await getUser();

    if (
      !user ||
      !user.isActive ||
      user.role !== "ADMIN"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Only administrators can manage vehicle types.",
        },
        { status: 403 }
      );
    }

    const body =
      await request.json();

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const rawSeatCount =
      body.seatCount;

    const seatCount =
      rawSeatCount === null ||
      rawSeatCount === undefined ||
      rawSeatCount === ""
        ? null
        : Number(rawSeatCount);

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Vehicle type name is required.",
        },
        { status: 400 }
      );
    }

    if (
      seatCount !== null &&
      (!Number.isInteger(
        seatCount
      ) ||
        seatCount <= 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Seat count must be a positive whole number.",
        },
        { status: 400 }
      );
    }

    const existing =
      await prisma.vehicleType.findUnique({
        where: {
          name,
        },
      });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This vehicle type already exists.",
        },
        { status: 409 }
      );
    }

    const vehicleType =
      await prisma.vehicleType.create({
        data: {
          name,
          seatCount,
          isActive: true,
        },
      });

    await writeAuditLog({
      userId: user.id,
      module: "VEHICLE_TYPE",
      action: "CREATE",
      entity: "VehicleType",
      entityId: String(
        vehicleType.id
      ),
      description:
        `Created vehicle type ${vehicleType.name}.`,
      metadata: {
        seatCount:
          vehicleType.seatCount,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message:
          "Vehicle type created successfully.",
        vehicleType,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Vehicle types POST error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to create vehicle type.",
      },
      { status: 500 }
    );
  }
}