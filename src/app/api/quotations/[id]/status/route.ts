import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { QuotationStatus } from "@/generated/prisma/client";
import { expireOverdueQuotations } from "@/lib/quotation-expiry";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UpdateStatusBody = {
  status?: string;
};

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
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

    const { id: idParam } = await context.params;
    const id = Number(idParam);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid quotation ID.",
        },
        { status: 400 }
      );
    }

    let body: UpdateStatusBody;

    try {
      body = (await request.json()) as UpdateStatusBody;
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid JSON request body.",
        },
        { status: 400 }
      );
    }

    const nextStatus = body.status;

    if (
      nextStatus !== QuotationStatus.ACCEPTED &&
      nextStatus !== QuotationStatus.REJECTED
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Status must be ACCEPTED or REJECTED.",
        },
        { status: 400 }
      );
    }

    await expireOverdueQuotations();

    const existing = await prisma.quotation.findUnique({
      where: { id },
      select: {
        id: true,
        quotationNo: true,
        customerName: true,
        status: true,

        invoice: {
          select: {
            id: true,
            invoiceNo: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message: "Quotation not found.",
        },
        { status: 404 }
      );
    }

    if (existing.status === QuotationStatus.EXPIRED) {
  return NextResponse.json(
    {
      success: false,
      message:
        "This quotation has expired and cannot be accepted or rejected.",
    },
    { status: 409 }
  );
}

    if (existing.status === QuotationStatus.CANCELLED) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A cancelled quotation cannot be accepted or rejected.",
        },
        { status: 409 }
      );
    }

    if (existing.invoice) {
      return NextResponse.json(
        {
          success: false,
          message: `This quotation already has invoice ${existing.invoice.invoiceNo}; its decision status cannot be changed.`,
        },
        { status: 409 }
      );
    }

    if (existing.status === nextStatus) {
      return NextResponse.json({
        success: true,
        message: `Quotation is already ${nextStatus.toLowerCase()}.`,
        quotation: {
          id: existing.id,
          quotationNo: existing.quotationNo,
          status: existing.status,
        },
      });
    }

    const quotation = await prisma.quotation.update({
      where: { id },
      data: {
        status: nextStatus,
      },
      select: {
        id: true,
        quotationNo: true,
        customerName: true,
        status: true,
        updatedAt: true,
      },
    });

    await writeAuditLog({
      userId,
      module: "QUOTATION",
      action:
        nextStatus === QuotationStatus.ACCEPTED
          ? "ACCEPT"
          : "REJECT",
      entity: "Quotation",
      entityId: String(quotation.id),
      description: `${
        nextStatus === QuotationStatus.ACCEPTED
          ? "Accepted"
          : "Rejected"
      } quotation ${quotation.quotationNo} for ${quotation.customerName}.`,
      metadata: {
        previousStatus: existing.status,
        newStatus: quotation.status,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Quotation ${nextStatus.toLowerCase()} successfully.`,
      quotation,
    });
  } catch (error) {
    console.error("Quotation status PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update quotation status.",
      },
      { status: 500 }
    );
  }
}