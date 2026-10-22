import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { InvoiceStatus, Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; itemId: string }>;
};

type RouteError = Error & { statusCode?: number };

function fail(message: string, statusCode: number): RouteError {
  const error = new Error(message) as RouteError;
  error.statusCode = statusCode;
  return error;
}

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function cents(value: unknown) {
  return Math.round(numberValue(value) * 100);
}

function decimalFromCents(value: number) {
  return new Prisma.Decimal((value / 100).toFixed(2));
}

function quantityValue(value: unknown, label = "Quantity") {
  const quantity = Number(value);
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > 99_999_999.99 ||
    Math.abs(quantity * 100 - Math.round(quantity * 100)) > 0.000001
  ) {
    throw fail(`${label} must be greater than zero and may have up to two decimal places.`, 400);
  }
  return quantity;
}

function passengerQuantity(value: unknown, currentValue: number | null, label: string) {
  const quantity = value === undefined ? Number(currentValue ?? 0) : Number(value);
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 999_999) {
    throw fail(`${label} quantity must be a whole number from 0 to 999,999.`, 400);
  }
  return quantity;
}

function formatMoney(centsValue: number) {
  return (centsValue / 100).toFixed(2);
}

function ticketDescription(item: {
  airlineName: string | null;
  ticketType: string | null;
  baggageWeightKg: Prisma.Decimal | number | string | null;
  adultPrice: Prisma.Decimal | number | string | null;
  adultQuantity: number | null;
  childPrice: Prisma.Decimal | number | string | null;
  childQuantity: number | null;
  infantPrice: Prisma.Decimal | number | string | null;
  infantQuantity: number | null;
}, currency: string) {
  const parts = [
    "Air Ticket",
    item.airlineName?.trim() ?? "",
    item.ticketType === "RETURN" ? "Return Ticket" : "One Way Ticket",
    item.baggageWeightKg == null || numberValue(item.baggageWeightKg) <= 0
      ? ""
      : `Baggage ${numberValue(item.baggageWeightKg)} kg`,
  ];

  const passengers = [
    { label: "Adult", price: item.adultPrice, quantity: item.adultQuantity },
    { label: "Child", price: item.childPrice, quantity: item.childQuantity },
    { label: "Infant", price: item.infantPrice, quantity: item.infantQuantity },
  ];

  for (const passenger of passengers) {
    const quantity = Number(passenger.quantity ?? 0);
    if (quantity > 0) {
      parts.push(
        `${passenger.label} ${currency} ${formatMoney(cents(passenger.price))} × ${quantity}`
      );
    }
  }

  return parts.filter(Boolean).join(" · ");
}

function lineTotals(item: {
  serviceType: string;
  amount: Prisma.Decimal | number | string;
  quantity: Prisma.Decimal | number | string;
  discount: Prisma.Decimal | number | string;
  numberOfDays: number | null;
}) {
  const factor = item.serviceType === "HOTEL_ACCOMMODATION"
    ? Math.max(1, Number(item.numberOfDays ?? 1))
    : 1;
  const subtotalCents = Math.max(
    0,
    Math.round(numberValue(item.amount) * numberValue(item.quantity) * factor * 100)
  );
  const discountCents = Math.max(0, cents(item.discount));
  return {
    subtotalCents,
    discountCents,
    totalCents: Math.max(0, subtotalCents - discountCents),
  };
}

async function recalculateQuotation(tx: Prisma.TransactionClient, quotationId: number) {
  const items = await tx.quotationItem.findMany({ where: { quotationId }, orderBy: { sortOrder: "asc" } });
  const totals = items.reduce((sum, item) => {
    const line = lineTotals(item);
    sum.subtotal += line.subtotalCents;
    sum.discount += line.discountCents;
    sum.total += line.totalCents;
    return sum;
  }, { subtotal: 0, discount: 0, total: 0 });

  return tx.quotation.update({
    where: { id: quotationId },
    data: {
      subtotal: decimalFromCents(totals.subtotal),
      discount: decimalFromCents(totals.discount),
      totalAmount: decimalFromCents(totals.total),
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
}

async function recalculateInvoice(tx: Prisma.TransactionClient, invoiceId: number) {
  const items = await tx.invoiceItem.findMany({ where: { invoiceId }, orderBy: { sortOrder: "asc" } });
  const totals = items.reduce((sum, item) => {
    const line = lineTotals(item);
    sum.subtotal += line.subtotalCents;
    sum.discount += line.discountCents;
    sum.total += line.totalCents;
    return sum;
  }, { subtotal: 0, discount: 0, total: 0 });

  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: { paidAmount: true, status: true },
  });
  if (!invoice) throw fail("Invoice not found while recalculating totals.", 404);
  if (invoice.status === InvoiceStatus.CANCELLED) {
    throw fail("Cancelled invoices cannot be edited.", 400);
  }

  const paidCents = cents(invoice.paidAmount);
  const balanceCents = Math.max(0, totals.total - paidCents);
  const status = balanceCents === 0
    ? InvoiceStatus.PAID
    : paidCents > 0
      ? InvoiceStatus.PARTIALLY_PAID
      : InvoiceStatus.UNPAID;

  return tx.invoice.update({
    where: { id: invoiceId },
    data: {
      subtotal: decimalFromCents(totals.subtotal),
      discount: decimalFromCents(totals.discount),
      totalAmount: decimalFromCents(totals.total),
      // Do not modify paidAmount or payment rows; only recalculate the due.
      balanceAmount: decimalFromCents(balanceCents),
      status,
    },
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { id: rawId, itemId: rawItemId } = await context.params;
    const quotationId = parseId(rawId);
    const itemId = parseId(rawItemId);
    if (!quotationId || !itemId) {
      return NextResponse.json({ success: false, message: "Invalid quotation or service ID." }, { status: 400 });
    }

    let body: {
      quantity?: unknown;
      adultQuantity?: unknown;
      childQuantity?: unknown;
      infantQuantity?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, message: "Invalid JSON request body." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.findUnique({
        where: { id: quotationId },
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          invoice: { include: { items: { orderBy: { sortOrder: "asc" } } } },
        },
      });
      if (!quotation) throw fail("Quotation not found.", 404);

      const item = quotation.items.find((row) => row.id === itemId);
      if (!item) throw fail("Service was not found in this quotation.", 404);
      if (quotation.invoice?.status === InvoiceStatus.CANCELLED) {
        throw fail("Quantities cannot be changed because the linked invoice is cancelled.", 400);
      }

      let data: Prisma.QuotationItemUpdateInput & Prisma.InvoiceItemUpdateInput = {};
      let amountCents = cents(item.amount);
      let quantity = numberValue(item.quantity);
      let description = item.description;

      if (item.serviceType === "AIR_TICKET") {
        const adultQuantity = passengerQuantity(body.adultQuantity, item.adultQuantity, "Adult");
        const childQuantity = passengerQuantity(body.childQuantity, item.childQuantity, "Child");
        const infantQuantity = passengerQuantity(body.infantQuantity, item.infantQuantity, "Infant");
        if (adultQuantity + childQuantity + infantQuantity <= 0) {
          throw fail("At least one adult, child, or infant passenger is required.", 400);
        }

        amountCents =
          cents(item.adultPrice) * adultQuantity +
          cents(item.childPrice) * childQuantity +
          cents(item.infantPrice) * infantQuantity;
        quantity = 1;
        description = ticketDescription({
          airlineName: item.airlineName,
          ticketType: item.ticketType,
          baggageWeightKg: item.baggageWeightKg,
          adultPrice: item.adultPrice,
          adultQuantity,
          childPrice: item.childPrice,
          childQuantity,
          infantPrice: item.infantPrice,
          infantQuantity,
        }, quotation.currency ?? "SAR");
        data = {
          amount: decimalFromCents(amountCents),
          quantity: new Prisma.Decimal("1.00"),
          adultQuantity,
          childQuantity,
          infantQuantity,
          description,
        };
      } else {
        quantity = quantityValue(body.quantity, item.serviceType === "HOTEL_ACCOMMODATION" ? "Room quantity" : "Quantity");
        data = { quantity: new Prisma.Decimal(quantity.toFixed(2)) };
      }

      const effectiveItem = {
        serviceType: item.serviceType,
        amount: decimalFromCents(amountCents),
        quantity: new Prisma.Decimal(quantity.toFixed(2)),
        discount: item.discount,
        numberOfDays: item.numberOfDays,
      };
      const updatedLine = lineTotals(effectiveItem);
      data.totalAmount = decimalFromCents(updatedLine.totalCents);

      await tx.quotationItem.update({ where: { id: item.id }, data: data as Prisma.QuotationItemUpdateInput });

      let linkedInvoiceId: number | null = null;
      if (quotation.invoice) {
        const invoiceItem = quotation.invoice.items.find(
          (row) => row.sortOrder === item.sortOrder && row.serviceType === item.serviceType
        );
        if (!invoiceItem) {
          throw fail("The matching invoice service could not be found. No changes were saved.", 409);
        }
        await tx.invoiceItem.update({ where: { id: invoiceItem.id }, data: data as Prisma.InvoiceItemUpdateInput });
        linkedInvoiceId = quotation.invoice.id;
      }

      const updatedQuotation = await recalculateQuotation(tx, quotation.id);
      const updatedInvoice = linkedInvoiceId
        ? await recalculateInvoice(tx, linkedInvoiceId)
        : null;

      return { quotation: updatedQuotation, invoice: updatedInvoice, linkedInvoiceId };
    });

    await writeAuditLog({
      userId,
      module: "QUOTATION",
      action: "UPDATE_SERVICE_QUANTITY",
      entity: "QuotationItem",
      entityId: String(itemId),
      description: `Updated service quantity for quotation ${result.quotation.quotationNo}.${result.linkedInvoiceId ? " Linked invoice totals and outstanding balance were recalculated; payment history was retained." : ""}`,
      metadata: {
        quotationId,
        itemId,
        invoiceId: result.linkedInvoiceId,
        currency: result.quotation.currency ?? "SAR",
        totalAmount: result.quotation.totalAmount.toString(),
        invoiceBalanceAmount: result.invoice?.balanceAmount.toString() ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Service quantity updated. Existing payment history was retained and the balance was recalculated.",
      quotation: result.quotation,
      invoice: result.invoice,
    });
  } catch (error) {
    console.error("Quotation item quantity update error:", error);
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as RouteError).statusCode ?? 500)
      : 500;
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "Unable to update service quantity.",
    }, { status: statusCode });
  }
}
