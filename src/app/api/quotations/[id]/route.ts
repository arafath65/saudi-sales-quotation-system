import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { expireOverdueQuotations } from "@/lib/quotation-expiry";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized.",
      },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const quotationId = Number(id);

    if (
      !Number.isInteger(quotationId) ||
      quotationId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid quotation ID.",
        },
        { status: 400 }
      );
    }

    // Update quotations whose validity has expired.
    await expireOverdueQuotations();

    // Load the quotation and its related records.
    // Prisma also returns scalar fields, including the two
    // JSON snapshot fields added to the Quotation model.
    const quotation = await prisma.quotation.findUnique({
      where: {
        id: quotationId,
      },
      include: {
        customer: true,

        createdBy: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },

        items: {
          orderBy: {
            sortOrder: "asc",
          },
          include: {
            route: true,
            vehicleType: true,
          },
        },
      },
    });

    if (!quotation) {
      return NextResponse.json(
        {
          success: false,
          message: "Quotation not found.",
        },
        { status: 404 }
      );
    }

    // Older quotations may not have bank or terms snapshots.
    // Return empty arrays for those records so the print page
    // can safely render quotations created before this feature.
    const quotationWithSnapshots = {
      ...quotation,
      bankDetailsSnapshot:
        quotation.bankDetailsSnapshot ?? [],
      termsConditionsSnapshot:
        quotation.termsConditionsSnapshot ?? [],
    };

    // Load the current company information for the document header.
    const company =
      await prisma.companySettings.findUnique({
        where: {
          id: 1,
        },
      });

    await writeAuditLog({
      userId,
      module: "QUOTATION",
      action: "VIEW",
      entity: "Quotation",
      entityId: String(quotation.id),
      description:
        `Viewed quotation ${quotation.quotationNo}.`,
      metadata: {
        quotationNo: quotation.quotationNo,
        customerId: quotation.customerId,
        totalAmount: quotation.totalAmount.toString(),
      },
    });

    return NextResponse.json({
      success: true,
      quotation: quotationWithSnapshots,
      company,
    });
  } catch (error) {
    console.error("Quotation GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load quotation.",
      },
      { status: 500 }
    );
  }
}