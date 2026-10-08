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
            "Invalid route ID.",
        },
        { status: 400 }
      );
    }

    const route =
      await prisma.route.findUnique({
        where: {
          id,
        },
      });

    if (!route) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Route not found.",
        },
        { status: 404 }
      );
    }

    await writeAuditLog({
      userId: user.id,
      module: "ROUTE",
      action: "VIEW",
      entity: "Route",
      entityId: String(
        route.id
      ),
      description:
        `Viewed route ${route.name}.`,
    });

    return NextResponse.json({
      success: true,
      route,
    });
  } catch (error) {
    console.error(
      "Route GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to load route.",
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
            "Only administrators can manage routes.",
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
            "Invalid route ID.",
        },
        { status: 400 }
      );
    }

    const existing =
      await prisma.route.findUnique({
        where: {
          id,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Route not found.",
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
            "Route name is required.",
        },
        { status: 400 }
      );
    }

    const duplicate =
      await prisma.route.findFirst({
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
            "This route already exists.",
        },
        { status: 409 }
      );
    }

    const route =
      await prisma.route.update({
        where: {
          id,
        },
        data: {
          name,
          isActive,
        },
      });

    const action =
      existing.isActive !==
      route.isActive
        ? route.isActive
          ? "ACTIVATE"
          : "DEACTIVATE"
        : "UPDATE";

    await writeAuditLog({
      userId: user.id,
      module: "ROUTE",
      action,
      entity: "Route",
      entityId: String(
        route.id
      ),
      description:
        existing.isActive !==
        route.isActive
          ? `${route.isActive ? "Activated" : "Deactivated"} route ${route.name}.`
          : `Updated route ${route.name}.`,
      metadata: {
        isActive:
          route.isActive,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Route updated successfully.",
      route,
    });
  } catch (error) {
    console.error(
      "Route PATCH error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to update route.",
      },
      { status: 500 }
    );
  }
}