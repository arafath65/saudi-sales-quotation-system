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

async function parseId(
  params: Promise<{
    id: string;
  }>
) {
  const { id } =
    await params;

  const parsed =
    Number(id);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
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

    const id =
      await parseId(params);

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid vehicle type ID.",
        },
        { status: 400 }
      );
    }

    const vehicleType =
      await prisma.vehicleType.findUnique({
        where: {
          id,
        },
      });

    if (!vehicleType) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Vehicle type not found.",
        },
        { status: 404 }
      );
    }

    await writeAuditLog({
      userId: user.id,
      module: "VEHICLE_TYPE",
      action: "VIEW",
      entity: "VehicleType",
      entityId: String(
        vehicleType.id
      ),
      description:
        `Viewed vehicle type ${vehicleType.name}.`,
    });

    return NextResponse.json({
      success: true,
      vehicleType,
    });
  } catch (error) {
    console.error(
      "Vehicle type GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to load vehicle type.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
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

    const id =
      await parseId(params);

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid vehicle type ID.",
        },
        { status: 400 }
      );
    }

    const existing =
      await prisma.vehicleType.findUnique({
        where: {
          id,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Vehicle type not found.",
        },
        { status: 404 }
      );
    }

    const body =
      await request.json();

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : existing.name;

    const rawSeatCount =
      body.seatCount;

    const seatCount =
      rawSeatCount === null ||
      rawSeatCount === undefined ||
      rawSeatCount === ""
        ? null
        : Number(rawSeatCount);

    const isActive =
      typeof body.isActive ===
      "boolean"
        ? body.isActive
        : existing.isActive;

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

    const duplicate =
      await prisma.vehicleType.findFirst({
        where: {
          name,
          id: {
            not: id,
          },
        },
      });

    if (duplicate) {
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
      await prisma.vehicleType.update({
        where: {
          id,
        },
        data: {
          name,
          seatCount,
          isActive,
        },
      });

    const action =
      existing.isActive !==
      vehicleType.isActive
        ? vehicleType.isActive
          ? "ACTIVATE"
          : "DEACTIVATE"
        : "UPDATE";

    await writeAuditLog({
      userId: user.id,
      module: "VEHICLE_TYPE",
      action,
      entity: "VehicleType",
      entityId: String(
        vehicleType.id
      ),
      description:
        existing.isActive !==
        vehicleType.isActive
          ? `${vehicleType.isActive ? "Activated" : "Deactivated"} vehicle type ${vehicleType.name}.`
          : `Updated vehicle type ${vehicleType.name}.`,
      metadata: {
        seatCount:
          vehicleType.seatCount,
        isActive:
          vehicleType.isActive,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Vehicle type updated successfully.",
      vehicleType,
    });
  } catch (error) {
    console.error(
      "Vehicle type PATCH error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to update vehicle type.",
      },
      { status: 500 }
    );
  }
}