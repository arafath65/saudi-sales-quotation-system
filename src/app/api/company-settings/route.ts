import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

async function requireAdmin() {
  const userId = await getSessionUserId();

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      role: true,
      isActive: true,
    },
  });

  if (
    !user ||
    !user.isActive ||
    user.role !== "ADMIN"
  ) {
    return null;
  }

  return user;
}

export async function GET() {
  try {
    const user = await requireAdmin();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const settings =
      await prisma.companySettings.findUnique({
        where: {
          id: 1,
        },
      });

    await writeAuditLog({
      userId: user.id,
      module: "COMPANY_SETTINGS",
      action: "VIEW",
      entity: "CompanySettings",
      entityId: "1",
      description:
        "Viewed company settings.",
    });

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error(
      "Company settings GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to load company settings.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request
) {
  try {
    const user = await requireAdmin();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const companyName =
      typeof body.companyName === "string"
        ? body.companyName.trim()
        : "";

    const address =
      typeof body.address === "string"
        ? body.address.trim()
        : null;

    const phone =
      typeof body.phone === "string"
        ? body.phone.trim()
        : null;

    const email =
      typeof body.email === "string"
        ? body.email.trim()
        : null;

    const website =
      typeof body.website === "string"
        ? body.website.trim()
        : null;

    const taxNumber =
      typeof body.taxNumber === "string"
        ? body.taxNumber.trim()
        : null;

    if (!companyName) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Company name is required.",
        },
        { status: 400 }
      );
    }

    const settings =
      await prisma.companySettings.upsert({
        where: {
          id: 1,
        },
        create: {
          id: 1,
          companyName,
          address,
          phone,
          email,
          website,
          taxNumber,
        },
        update: {
          companyName,
          address,
          phone,
          email,
          website,
          taxNumber,
        },
      });

    await writeAuditLog({
      userId: user.id,
      module: "COMPANY_SETTINGS",
      action: "UPDATE",
      entity: "CompanySettings",
      entityId: "1",
      description:
        "Updated company settings.",
      metadata: {
        companyName:
          settings.companyName,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Company settings saved successfully.",
      settings,
    });
  } catch (error) {
    console.error(
      "Company settings PATCH error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to save company settings.",
      },
      { status: 500 }
    );
  }
}