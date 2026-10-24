import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function requireSession() {
  const userId = await getSessionUserId();

  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true },
  });
}

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const name = value.trim();
  return name || null;
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const user = await requireSession();

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const { id: idParam } = await context.params;
    const id = Number(idParam);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid airline ID." },
        { status: 400 }
      );
    }

    let body: Record<string, unknown>;

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const existing = await prisma.airline.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Airline not found." },
        { status: 404 }
      );
    }

    const data: {
      name?: string;
      isActive?: boolean;
    } = {};

    if ("name" in body) {
      const name = cleanName(body.name);

      if (!name) {
        return NextResponse.json(
          { success: false, message: "Airline name is required." },
          { status: 400 }
        );
      }

      if (name.length > 100) {
        return NextResponse.json(
          {
            success: false,
            message: "Airline name cannot exceed 100 characters.",
          },
          { status: 400 }
        );
      }

      const duplicate = await prisma.airline.findFirst({
        where: {
          name,
          NOT: { id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { success: false, message: "This airline already exists." },
          { status: 409 }
        );
      }

      data.name = name;
    }

    if ("isActive" in body) {
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
          message: "No airline changes were supplied.",
        },
        { status: 400 }
      );
    }

    const airline = await prisma.airline.update({
      where: { id },
      data,
    });

    const changedFields = Object.keys(data);
    const statusOnly =
      changedFields.length === 1 &&
      changedFields[0] === "isActive";

    await writeAuditLog({
      userId: user.id,
      module: "SERVICE_SETTINGS",
      action: statusOnly
        ? airline.isActive
          ? "ACTIVATE"
          : "DEACTIVATE"
        : "UPDATE",
      entity: "Airline",
      entityId: String(airline.id),
      description: statusOnly
        ? `${airline.isActive ? "Activated" : "Deactivated"} airline ${airline.name}.`
        : `Updated airline ${airline.name}.`,
      metadata: {
        changedFields,
        airlineName: airline.name,
      },
    });

    return NextResponse.json({
      success: true,
      message: statusOnly
        ? "Airline status updated successfully."
        : "Airline updated successfully.",
      airline,
    });
  } catch (error) {
    console.error("Airline PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update airline.",
      },
      { status: 500 }
    );
  }
}