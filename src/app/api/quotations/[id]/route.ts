import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export const dynamic =
  "force-dynamic";

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
  const userId =
    await getSessionUserId();

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
    const { id } =
      await params;

    const quotationId =
      Number(id);

    if (
      !Number.isInteger(
        quotationId
      ) ||
      quotationId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid quotation ID.",
        },
        { status: 400 }
      );
    }

    const quotation =
      await prisma.quotation.findUnique({
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
          message:
            "Quotation not found.",
        },
        { status: 404 }
      );
    }

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
      entityId: String(
        quotation.id
      ),
      description:
        `Viewed quotation ${quotation.quotationNo}.`,
      metadata: {
        quotationNo:
          quotation.quotationNo,
        customerId:
          quotation.customerId,
        totalAmount:
          quotation.totalAmount.toString(),
      },
    });

    return NextResponse.json({
      success: true,
      quotation,
      company,
    });
  } catch (error) {
    console.error(
      "Quotation GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to load quotation.",
      },
      { status: 500 }
    );
  }
}