import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  InvoiceStatus,
  PaymentMethod,
  Prisma,
} from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseId(value: string) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function moneyNumber(value: Prisma.Decimal | number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

const paymentMethods = new Set<string>([
  PaymentMethod.CASH,
  PaymentMethod.CARD,
  PaymentMethod.ONLINE_TRANSFER,
  PaymentMethod.CHEQUE,
  PaymentMethod.OTHER,
]);

export async function GET(
  _request: Request,
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
    const id = parseId(idParam);

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid invoice ID.",
        },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: {
        id,
      },
      include: {
        quotation: {
          select: {
            id: true,
            quotationNo: true,
          },
        },
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
        payments: {
          orderBy: {
            paymentDate: "desc",
          },
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                username: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        {
          success: false,
          message: "Invoice not found.",
        },
        { status: 404 }
      );
    }

    const company = await prisma.companySettings.findUnique({
      where: {
        id: 1,
      },
    });

    const customer = {
      id: invoice.customerId,
      name: invoice.customerName,
      mobile: invoice.customerMobile,
      whatsapp: invoice.customerWhatsapp,
      email: invoice.customerEmail,
      address: invoice.customerAddress,
      nationality: invoice.customerNationality,
      passportNo: invoice.customerPassportNo,
    };

    await writeAuditLog({
      userId,
      module: "INVOICE",
      action: "VIEW",
      entity: "Invoice",
      entityId: String(invoice.id),
      description: `Viewed invoice ${invoice.invoiceNo}.`,
    });

    return NextResponse.json({
      success: true,
      invoice: {
        ...invoice,
        customer,
      },
      company,
    });
  } catch (error) {
    console.error("Invoice GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load invoice.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const id = parseId(idParam);

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid invoice ID.",
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as {
      action?: string;
      amount?: number | string;
      method?: string;
      referenceNo?: string;
      notes?: string;
    };

    if (body.action !== "PAYMENT") {
      return NextResponse.json(
        {
          success: false,
          message: "Unsupported invoice action.",
        },
        { status: 400 }
      );
    }

    const amount = Number(body.amount ?? 0);
    const method = String(body.method ?? "").trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Payment amount must be greater than zero.",
        },
        { status: 400 }
      );
    }

    if (!paymentMethods.has(method)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid payment method.",
        },
        { status: 400 }
      );
    }

    const invoiceBeforePayment = await prisma.invoice.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        invoiceNo: true,
        currency: true,
        totalAmount: true,
        paidAmount: true,
        balanceAmount: true,
        status: true,
      },
    });

    if (!invoiceBeforePayment) {
      return NextResponse.json(
        {
          success: false,
          message: "Invoice not found.",
        },
        { status: 404 }
      );
    }

    if (invoiceBeforePayment.status === InvoiceStatus.CANCELLED) {
      return NextResponse.json(
        {
          success: false,
          message: "Cancelled invoices cannot receive payments.",
        },
        { status: 400 }
      );
    }

    const currentBalance = moneyNumber(invoiceBeforePayment.balanceAmount);

    if (amount > currentBalance + 0.0001) {
      return NextResponse.json(
        {
          success: false,
          message: `Payment cannot exceed the current due of ${invoiceBeforePayment.currency ?? "SAR"} ${currentBalance.toFixed(2)}.`,
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId: id,
          paymentDate: new Date(),
          amount: new Prisma.Decimal(amount.toFixed(2)),
          method: method as PaymentMethod,
          referenceNo: body.referenceNo?.trim() || null,
          notes: body.notes?.trim() || null,
          createdById: userId,
        },
      });

      const newPaidAmount =
        moneyNumber(invoiceBeforePayment.paidAmount) + amount;

      const newBalanceAmount = Math.max(
        0,
        moneyNumber(invoiceBeforePayment.totalAmount) - newPaidAmount
      );

      const newStatus =
        newBalanceAmount <= 0.0001
          ? InvoiceStatus.PAID
          : newPaidAmount > 0
            ? InvoiceStatus.PARTIALLY_PAID
            : InvoiceStatus.UNPAID;

      const invoice = await tx.invoice.update({
        where: {
          id,
        },
        data: {
          paidAmount: new Prisma.Decimal(newPaidAmount.toFixed(2)),
          balanceAmount: new Prisma.Decimal(newBalanceAmount.toFixed(2)),
          status: newStatus,
        },
      });

      return {
        payment,
        invoice,
      };
    });

    await writeAuditLog({
      userId,
      module: "INVOICE",
      action: "PAYMENT_CREATE",
      entity: "Payment",
      entityId: String(result.payment.id),
      description: `Recorded ${invoiceBeforePayment.currency ?? "SAR"} ${amount.toFixed(2)} payment for invoice ${invoiceBeforePayment.invoiceNo}.`,
      metadata: {
        invoiceId: id,
        invoiceNo: invoiceBeforePayment.invoiceNo,
        amount,
        method,
        referenceNo: body.referenceNo?.trim() || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Payment recorded successfully.",
      payment: result.payment,
      invoice: result.invoice,
    });
  } catch (error) {
    console.error("Invoice POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to record payment.",
      },
      { status: 500 }
    );
  }
}
