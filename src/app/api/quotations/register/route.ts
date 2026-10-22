import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { InvoiceStatus, Prisma, QuotationStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const quotationStatuses = new Set<string>(Object.values(QuotationStatus));
const invoiceStatuses = new Set<string>(Object.values(InvoiceStatus));

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") ?? "").trim();
    const statusParam = (searchParams.get("status") ?? "").trim();
    const billingParam = (searchParams.get("billing") ?? "").trim();

    const where: Prisma.QuotationWhereInput = {};

    if (quotationStatuses.has(statusParam)) {
      where.status = statusParam as QuotationStatus;
    }

    if (search) {
      where.OR = [
        { quotationNo: { contains: search } },
        { customerName: { contains: search } },
        { customerMobile: { contains: search } },
        { customer: { is: { passportNo: { contains: search } } } },
        { customer: { is: { customerCode: { contains: search } } } },
      ];
    }

    if (billingParam === "NOT_INVOICED") {
      where.invoice = { is: null };
    } else if (billingParam === "INVOICED") {
      where.invoice = { isNot: null };
    } else if (invoiceStatuses.has(billingParam)) {
      where.invoice = { is: { status: billingParam as InvoiceStatus } };
    }

    const quotations = await prisma.quotation.findMany({
      where,
      orderBy: [{ quotationDate: "desc" }, { id: "desc" }],
      take: 500,
      select: {
        id: true,
        quotationNo: true,
        quotationDate: true,
        validUntil: true,
        currency: true,
        customerId: true,
        customerName: true,
        customerMobile: true,
        subtotal: true,
        discount: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        customer: {
          select: {
            customerCode: true,
            passportNo: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNo: true,
            currency: true,
            status: true,
            totalAmount: true,
            paidAmount: true,
            balanceAmount: true,
          },
        },
        _count: { select: { items: true } },
      },
    });

    await writeAuditLog({
      userId,
      module: "QUOTATION",
      action: "LIST",
      entity: "Quotation",
      description: `Viewed quotation register${search ? ` searching "${search}"` : ""}.`,
      metadata: {
        search,
        status: statusParam || null,
        billing: billingParam || null,
        resultCount: quotations.length,
      },
    });

    return NextResponse.json({ success: true, quotations, resultCount: quotations.length });
  } catch (error) {
    console.error("Quotation register GET error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load quotations." },
      { status: 500 }
    );
  }
}
