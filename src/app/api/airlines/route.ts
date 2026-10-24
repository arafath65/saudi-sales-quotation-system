import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

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

export async function GET() {
  try {
    const user = await requireSession();

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const airlines = await prisma.airline.findMany({
      orderBy: { name: "asc" },
    });

    await writeAuditLog({
      userId: user.id,
      module: "SERVICE_SETTINGS",
      action: "LIST",
      entity: "Airline",
      description: "Viewed airline settings.",
      metadata: { resultCount: airlines.length },
    });

    return NextResponse.json({
      success: true,
      airlines,
    });
  } catch (error) {
    console.error("Airline GET error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load airlines." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSession();

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
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

    const duplicate = await prisma.airline.findUnique({
      where: { name },
    });

    if (duplicate) {
      return NextResponse.json(
        { success: false, message: "This airline already exists." },
        { status: 409 }
      );
    }

    const airline = await prisma.airline.create({
      data: { name },
    });

    await writeAuditLog({
      userId: user.id,
      module: "SERVICE_SETTINGS",
      action: "CREATE",
      entity: "Airline",
      entityId: String(airline.id),
      description: `Added airline ${airline.name}.`,
      metadata: { airlineName: airline.name },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Airline added successfully.",
        airline,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Airline POST error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to add airline." },
      { status: 500 }
    );
  }
}