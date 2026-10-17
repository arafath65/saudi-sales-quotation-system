import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { QuotationStatus } from "@/generated/prisma/client";
import {
  expireOverdueQuotations,
  getCurrentQuotationDate,
} from "@/lib/quotation-expiry";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UpdateValidityBody = {
  validUntil?: unknown;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const { id: idParam } = await context.params;
    const id = Number(idParam);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid quotation ID." },
        { status: 400 }
      );
    }

    let body: UpdateValidityBody;
    try {
      body = (await request.json()) as UpdateValidityBody;
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    if (typeof body.validUntil !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.validUntil)) {
      return NextResponse.json(
        { success: false, message: "A valid Valid Until date is required." },
        { status: 400 }
      );
    }

    const requestedDate = new Date(`${body.validUntil}T00:00:00.000Z`);
    if (
      Number.isNaN(requestedDate.getTime()) ||
      requestedDate.toISOString().slice(0, 10) !== body.validUntil
    ) {
      return NextResponse.json(
        { success: false, message: "The Valid Until date is not a real calendar date." },
        { status: 400 }
      );
    }

    const today = getCurrentQuotationDate();
    if (body.validUntil < today) {
      return NextResponse.json(
        { success: false, message: "The new Valid Until date must be today or a future date." },
        { status: 400 }
      );
    }

    // Update any overdue GENERATED quotations before deciding whether this quote can be extended.
    await expireOverdueQuotations();

    const existing = await prisma.quotation.findUnique({
      where: { id },
      select: {
        id: true,
        quotationNo: true,
        customerName: true,
        status: true,
        validUntil: true,
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
        { success: false, message: "Quotation not found." },
        { status: 404 }
      );
    }

    if (existing.invoice) {
      return NextResponse.json(
        {
          success: false,
          message: `Quotation ${existing.quotationNo} already has invoice ${existing.invoice.invoiceNo}; its validity cannot be changed.`,
        },
        { status: 409 }
      );
    }

    if (
      existing.status !== QuotationStatus.GENERATED &&
      existing.status !== QuotationStatus.EXPIRED
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Only pending or expired quotations can have their validity extended.",
        },
        { status: 409 }
      );
    }

    const currentValidUntil = existing.validUntil
      ? existing.validUntil.toISOString().slice(0, 10)
      : null;

    if (currentValidUntil && body.validUntil <= currentValidUntil) {
      return NextResponse.json(
        {
          success: false,
          message: "The new Valid Until date must be later than the existing Valid Until date.",
        },
        { status: 400 }
      );
    }

    const quotation = await prisma.quotation.update({
      where: { id },
      data: {
        validUntil: requestedDate,
        ...(existing.status === QuotationStatus.EXPIRED
          ? { status: QuotationStatus.GENERATED }
          : {}),
      },
      select: {
        id: true,
        quotationNo: true,
        customerName: true,
        status: true,
        validUntil: true,
        updatedAt: true,
      },
    });

    await writeAuditLog({
      userId,
      module: "QUOTATION",
      action: "UPDATE_VALIDITY",
      entity: "Quotation",
      entityId: String(quotation.id),
      description: `Extended validity of quotation ${quotation.quotationNo} for ${quotation.customerName} until ${body.validUntil}.`,
      metadata: {
        previousValidUntil: currentValidUntil,
        newValidUntil: body.validUntil,
        previousStatus: existing.status,
        newStatus: quotation.status,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        existing.status === QuotationStatus.EXPIRED
          ? "Quotation validity extended and quotation reactivated successfully."
          : "Quotation validity extended successfully.",
      quotation,
    });
  } catch (error) {
    console.error("Quotation validity PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to extend quotation validity." },
      { status: 500 }
    );
  }
}
