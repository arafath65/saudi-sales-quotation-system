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

    const routes =
      await prisma.route.findMany({
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
      module: "ROUTE",
      action: "LIST",
      entity: "Route",
      description:
        "Viewed transportation routes.",
      metadata: {
        resultCount:
          routes.length,
      },
    });

    return NextResponse.json({
      success: true,
      routes,
    });
  } catch (error) {
    console.error(
      "Routes GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to load routes.",
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
            "Only administrators can manage routes.",
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

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Route name is required.",
        },
        { status: 400 }
      );
    }

    const existing =
      await prisma.route.findUnique({
        where: {
          name,
        },
      });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This route already exists.",
        },
        { status: 409 }
      );
    }

    const route =
      await prisma.route.create({
        data: {
          name,
          isActive: true,
        },
      });

    await writeAuditLog({
      userId: user.id,
      module: "ROUTE",
      action: "CREATE",
      entity: "Route",
      entityId: String(
        route.id
      ),
      description:
        `Created route ${route.name}.`,
    });

    return NextResponse.json(
      {
        success: true,
        message:
          "Route created successfully.",
        route,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Routes POST error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to create route.",
      },
      { status: 500 }
    );
  }
}