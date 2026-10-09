import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  InvoiceStatus,
  Prisma,
  QuotationStatus,
} from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

function money(
  value: Prisma.Decimal | number | string | null | undefined
) {
  const number = Number(value ?? 0);

  return Number.isFinite(number) ? number : 0;
}

function formatInvoiceNumber(sequence: number) {
  const year = new Date().getFullYear();

  return `INV-${year}-${String(sequence).padStart(5, "0")}`;
}

function parseId(value: unknown) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function buildItemDescription(item: {
  description: string;
  serviceType: string;
  visaType: string | null;
  hotelName: string | null;
  paxCount: number | null;
  acType: string | null;
  boardType: string | null;
  ticketType: string | null;
  route?: { name: string } | null;
  vehicleType?: {
    name: string;
    seatCount: number | null;
  } | null;
}) {
  if (item.description?.trim()) {
    return item.description.trim();
  }

  const parts: string[] = [];

  switch (item.serviceType) {
    case "UMRAH_VISA":
      parts.push(
        item.visaType === "INDIVIDUAL_VISA"
          ? "Individual Visa"
          : item.visaType === "HOST_UMRAH_VISA"
            ? "Host Umrah Visa"
            : "Group"
      );
      break;

    case "HOTEL_ACCOMMODATION":
      if (item.hotelName) {
        parts.push(item.hotelName);
      }

      if (item.paxCount) {
        parts.push(`${item.paxCount} Pax`);
      }

      parts.push(item.acType === "NON_AC" ? "Non-AC" : "AC");

      parts.push(
        item.boardType === "BED_BREAKFAST"
          ? "Bed & Breakfast"
          : "Room Only"
      );
      break;

    case "AIR_TICKET":
      parts.push(
        item.ticketType === "RETURN"
          ? "Return Ticket"
          : "One Way Ticket"
      );
      break;

    case "TRANSPORTATION":
      if (item.route?.name) {
        parts.push(item.route.name);
      }

      if (item.vehicleType?.name) {
        parts.push(
          item.vehicleType.seatCount
            ? `${item.vehicleType.name} (${item.vehicleType.seatCount} seats)`
            : item.vehicleType.name
        );
      }
      break;
  }

  return parts.length ? parts.join(" · ") : "Service";
}

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim() ?? "";
    const status = searchParams.get("status")?.trim() ?? "";

    const where: Prisma.InvoiceWhereInput = {};

    if (
      status &&
      Object.values(InvoiceStatus).includes(status as InvoiceStatus)
    ) {
      where.status = status as InvoiceStatus;
    }

    if (search) {
      where.OR = [
        { invoiceNo: { contains: search } },
        { customerName: { contains: search } },
        { customerMobile: { contains: search } },
        { customerPassportNo: { contains: search } },
      ];
    }

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: {
        invoiceDate: "desc",
      },
      take: 500,
      select: {
        id: true,
        invoiceNo: true,
        quotationId: true,
        invoiceDate: true,
        customerId: true,
        customerName: true,
        customerMobile: true,
        totalAmount: true,
        paidAmount: true,
        balanceAmount: true,
        status: true,
        _count: {
          select: {
            payments: true,
            items: true,
          },
        },
      },
    });

    await writeAuditLog({
      userId,
      module: "INVOICE",
      action: "LIST",
      entity: "Invoice",
      description: `Viewed invoice list${
        search ? ` using search "${search}"` : ""
      }.`,
      metadata: {
        search,
        status: status || null,
        resultCount: invoices.length,
      },
    });

    return NextResponse.json({
      success: true,
      invoices,
    });
  } catch (error) {
    console.error("Invoice LIST error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load invoices.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    let body: {
      quotationId?: number | string;
    };

    try {
      body = (await request.json()) as {
        quotationId?: number | string;
      };
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid JSON request body.",
        },
        { status: 400 }
      );
    }

    const quotationId = parseId(body.quotationId);

    if (!quotationId) {
      return NextResponse.json(
        {
          success: false,
          message: "A valid quotation ID is required.",
        },
        { status: 400 }
      );
    }

    const quotation = await prisma.quotation.findUnique({
      where: {
        id: quotationId,
      },
      include: {
        customer: true,
        items: {
          orderBy: {
            sortOrder: "asc",
          },
          include: {
            route: true,
            vehicleType: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNo: true,
            status: true,
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

    // Do not create a second invoice for the same quotation.
    if (quotation.invoice) {
      return NextResponse.json(
        {
          success: false,
          message: `Invoice ${quotation.invoice.invoiceNo} already exists for this quotation.`,
          invoice: quotation.invoice,
        },
        { status: 409 }
      );
    }

    // The customer must accept the quotation before invoicing.
    if (quotation.status !== QuotationStatus.ACCEPTED) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This quotation has not been accepted yet. Open the Quotations register and mark it Accepted before creating an invoice.",
        },
        { status: 409 }
      );
    }

    if (quotation.items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Cannot create an invoice from a quotation without services.",
        },
        { status: 400 }
      );
    }

    const totalAmount = money(quotation.totalAmount);

    if (totalAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Quotation total must be greater than zero.",
        },
        { status: 400 }
      );
    }

    const currentYear = new Date().getFullYear();
    const yearPrefix = `INV-${currentYear}-`;

    const latestInvoice = await prisma.invoice.findFirst({
      where: {
        invoiceNo: {
          startsWith: yearPrefix,
        },
      },
      orderBy: {
        invoiceNo: "desc",
      },
      select: {
        invoiceNo: true,
      },
    });

    let sequence = 1;

    if (latestInvoice?.invoiceNo) {
      const match = latestInvoice.invoiceNo.match(/(\d+)$/);

      if (match) {
        sequence = Number(match[1]) + 1;
      }
    }

    const invoiceNo = formatInvoiceNumber(sequence);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNo,
        quotationId: quotation.id,
        customerId: quotation.customerId,
        invoiceDate: new Date(),

        // Store the customer details as a snapshot.
        customerName: quotation.customerName,
        customerMobile: quotation.customerMobile,
        customerWhatsapp: quotation.customerWhatsapp,
        customerEmail: quotation.customerEmail,
        customerAddress: quotation.customerAddress,
        customerNationality: quotation.customerNationality,
        customerPassportNo: quotation.customerPassportNo,

        subtotal: quotation.subtotal,
        discount: quotation.discount,
        totalAmount: quotation.totalAmount,

        paidAmount: new Prisma.Decimal("0.00"),
        balanceAmount: quotation.totalAmount,
        status: InvoiceStatus.UNPAID,
        notes: quotation.notes,

        createdById: userId,

        // Copy the quotation's services into invoice items.
        items: {
          create: quotation.items.map((item) => ({
            serviceType: item.serviceType,
            description: buildItemDescription(item),

            visaType: item.visaType,
            hotelName: item.hotelName,
            paxCount: item.paxCount,
            acType: item.acType,
            boardType: item.boardType,
            ticketType: item.ticketType,

            routeId: item.routeId,
            vehicleTypeId: item.vehicleTypeId,

            amount: item.amount,
            quantity: item.quantity,
            discount: item.discount,
            totalAmount: item.totalAmount,

            sortOrder: item.sortOrder,
          })),
        },
      },
      include: {
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    await writeAuditLog({
      userId,
      module: "INVOICE",
      action: "CREATE",
      entity: "Invoice",
      entityId: String(invoice.id),
      description: `Created invoice ${invoice.invoiceNo} from quotation ${quotation.quotationNo}.`,
      metadata: {
        quotationId: quotation.id,
        quotationNo: quotation.quotationNo,
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        totalAmount,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Invoice created successfully.",
        invoice,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Invoice POST create error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create invoice.",
      },
      { status: 500 }
    );
  }
}