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

type DashboardRange =
  | "THIS_MONTH"
  | "LAST_MONTH"
  | "LAST_3_MONTHS"
  | "LAST_6_MONTHS"
  | "LAST_1_YEAR"
  | "ALL_TIME";

function parseRange(value: string | null): DashboardRange {
  switch (value) {
    case "LAST_MONTH":
    case "LAST_3_MONTHS":
    case "LAST_6_MONTHS":
    case "LAST_1_YEAR":
    case "ALL_TIME":
    case "THIS_MONTH":
      return value;
    default:
      return "THIS_MONTH";
  }
}

function moneyNumber(
  value: Prisma.Decimal | number | string | null | undefined
): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function monthStart(date: Date, offset = 0) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function getCalendarPeriod(range: DashboardRange, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (range === "THIS_MONTH") {
    return { start: monthStart(today, 0), end: tomorrow };
  }

  if (range === "LAST_MONTH") {
    return { start: monthStart(today, -1), end: monthStart(today, 0) };
  }

  const months = range === "LAST_3_MONTHS" ? 3 : range === "LAST_6_MONTHS" ? 6 : 12;
  const targetMonth = monthStart(today, -months);
  const finalDayOfTargetMonth = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0
  ).getDate();
  const start = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    Math.min(today.getDate(), finalDayOfTargetMonth)
  );

  return { start, end: tomorrow };
}

function formatBucketLabel(date: Date, granularity: "day" | "month") {
  if (granularity === "day") {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "2-digit",
  }).format(date);
}

function bucketKey(date: Date, granularity: "day" | "month") {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  if (granularity === "month") return `${year}-${month}`;

  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildBuckets(
  start: Date,
  end: Date,
  range: DashboardRange,
  invoices: Array<{ invoiceDate: Date; totalAmount: Prisma.Decimal }>,
  payments: Array<{ paymentDate: Date; amount: Prisma.Decimal }>
) {
  const granularity: "day" | "month" =
    range === "THIS_MONTH" || range === "LAST_MONTH" ? "day" : "month";
  const buckets: Array<{
    key: string;
    label: string;
    invoiceAmount: number;
    collectedAmount: number;
  }> = [];
  const lookup = new Map<string, (typeof buckets)[number]>();

  let cursor = new Date(start);
  if (granularity === "day") {
    cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cursor < end) {
      const item = {
        key: bucketKey(cursor, granularity),
        label: formatBucketLabel(cursor, granularity),
        invoiceAmount: 0,
        collectedAmount: 0,
      };
      buckets.push(item);
      lookup.set(item.key, item);
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    cursor = monthStart(start);
    while (cursor < end) {
      const item = {
        key: bucketKey(cursor, granularity),
        label: formatBucketLabel(cursor, granularity),
        invoiceAmount: 0,
        collectedAmount: 0,
      };
      buckets.push(item);
      lookup.set(item.key, item);
      cursor = monthStart(cursor, 1);
    }
  }

  for (const invoice of invoices) {
    const item = lookup.get(bucketKey(invoice.invoiceDate, granularity));
    if (item) item.invoiceAmount += moneyNumber(invoice.totalAmount);
  }

  for (const payment of payments) {
    const item = lookup.get(bucketKey(payment.paymentDate, granularity));
    if (item) item.collectedAmount += moneyNumber(payment.amount);
  }

  return buckets;
}

function periodLabel(range: DashboardRange) {
  const labels: Record<DashboardRange, string> = {
    THIS_MONTH: "This Month",
    LAST_MONTH: "Last Month",
    LAST_3_MONTHS: "Last 3 Months",
    LAST_6_MONTHS: "Last 6 Months",
    LAST_1_YEAR: "Last 1 Year",
    ALL_TIME: "All Time",
  };
  return labels[range];
}

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });

    if (!user?.isActive) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const range = parseRange(searchParams.get("range"));
    const now = new Date();

    let start: Date;
    let end: Date;

    if (range === "ALL_TIME") {
      const [firstInvoice, firstPayment, firstQuotation] = await Promise.all([
        prisma.invoice.findFirst({
          orderBy: { invoiceDate: "asc" },
          select: { invoiceDate: true },
        }),
        prisma.payment.findFirst({
          orderBy: { paymentDate: "asc" },
          select: { paymentDate: true },
        }),
        prisma.quotation.findFirst({
          orderBy: { quotationDate: "asc" },
          select: { quotationDate: true },
        }),
      ]);

      const earliestDates = [
        firstInvoice?.invoiceDate,
        firstPayment?.paymentDate,
        firstQuotation?.quotationDate,
      ].filter((value): value is Date => Boolean(value));

      const earliest = earliestDates.length
        ? earliestDates.reduce((oldest, date) => (date < oldest ? date : oldest))
        : now;

      start = monthStart(earliest);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else {
      const period = getCalendarPeriod(range, now);
      start = period.start;
      end = period.end;
    }

    const dateFilter = { gte: start, lt: end };
    const invoiceWhere: Prisma.InvoiceWhereInput = {
      invoiceDate: dateFilter,
      status: { not: InvoiceStatus.CANCELLED },
    };
    const paymentWhere: Prisma.PaymentWhereInput = {
      paymentDate: dateFilter,
    };
    const quotationWhere: Prisma.QuotationWhereInput = {
      quotationDate: dateFilter,
    };

    const [
      invoiceAggregate,
      paymentAggregate,
      outstandingAggregate,
      pendingQuotationAggregate,
      pendingQuotationCount,
      quotationStatusGroups,
      invoiceChartRows,
      paymentChartRows,
      serviceGroups,
      outstandingRows,
      recentPaymentRows,
      acceptedQuotationRows,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: invoiceWhere,
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      prisma.payment.aggregate({
        where: paymentWhere,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.invoice.aggregate({
        where: {
          status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID] },
          balanceAmount: { gt: 0 },
        },
        _sum: { balanceAmount: true },
        _count: { _all: true },
      }),
      prisma.quotation.aggregate({
        where: { ...quotationWhere, status: QuotationStatus.GENERATED },
        _sum: { totalAmount: true },
      }),
      prisma.quotation.count({
        where: { ...quotationWhere, status: QuotationStatus.GENERATED },
      }),
      prisma.quotation.groupBy({
        by: ["status"],
        where: quotationWhere,
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      prisma.invoice.findMany({
        where: invoiceWhere,
        select: { invoiceDate: true, totalAmount: true },
      }),
      prisma.payment.findMany({
        where: paymentWhere,
        select: { paymentDate: true, amount: true },
      }),
      prisma.invoiceItem.groupBy({
        by: ["serviceType"],
        where: {
          invoice: {
            is: {
              invoiceDate: dateFilter,
              status: { not: InvoiceStatus.CANCELLED },
            },
          },
        },
        _sum: { totalAmount: true },
      }),
      prisma.invoice.findMany({
        where: {
          status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID] },
          balanceAmount: { gt: 0 },
        },
        orderBy: [{ balanceAmount: "desc" }, { invoiceDate: "asc" }],
        take: 8,
        select: {
          id: true,
          invoiceNo: true,
          invoiceDate: true,
          customerId: true,
          customerName: true,
          customerMobile: true,
          totalAmount: true,
          paidAmount: true,
          balanceAmount: true,
          status: true,
          quotation: {
            select: {
              customer: {
                select: { iqamaNo: true },
              },
            },
          },
        },
      }),
      prisma.payment.findMany({
        where: paymentWhere,
        orderBy: [{ paymentDate: "desc" }, { id: "desc" }],
        take: 8,
        select: {
          id: true,
          paymentDate: true,
          amount: true,
          method: true,
          referenceNo: true,
          invoice: {
            select: {
              id: true,
              invoiceNo: true,
              customerName: true,
              quotation: {
                select: {
                  customer: {
                    select: { iqamaNo: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.quotation.findMany({
        where: {
          ...quotationWhere,
          status: QuotationStatus.ACCEPTED,
          invoice: { is: null },
        },
        orderBy: [{ quotationDate: "asc" }, { id: "asc" }],
        take: 8,
        select: {
          id: true,
          quotationNo: true,
          quotationDate: true,
          customerName: true,
          customerMobile: true,
          totalAmount: true,
          customer: {
            select: { iqamaNo: true },
          },
        },
      }),
    ]);

    const chart = buildBuckets(
      start,
      end,
      range,
      invoiceChartRows,
      paymentChartRows
    );

    const quotationStatuses = Object.values(QuotationStatus).map((status) => {
      const group = quotationStatusGroups.find((item) => item.status === status);
      return {
        status,
        count: group?._count._all ?? 0,
        value: moneyNumber(group?._sum.totalAmount),
      };
    });

    const serviceLabels: Record<string, string> = {
      UMRAH_VISA: "Umrah Visa",
      HOTEL_ACCOMMODATION: "Hotel Accommodation",
      AIR_TICKET: "Air Ticket",
      TRANSPORTATION: "Transportation",
    };

    const serviceRevenue = serviceGroups
      .map((item) => ({
        serviceType: item.serviceType,
        label: serviceLabels[item.serviceType] ?? item.serviceType,
        amount: moneyNumber(item._sum.totalAmount),
      }))
      .sort((a, b) => b.amount - a.amount);

    await writeAuditLog({
      userId,
      module: "DASHBOARD",
      action: "VIEW",
      entity: "Dashboard",
      description: `Viewed sales dashboard for ${periodLabel(range)}.`,
      metadata: {
        range,
        invoicedCount: invoiceAggregate._count._all,
        paymentCount: paymentAggregate._count._all,
      },
    });

    return NextResponse.json({
      success: true,
      generatedAt: now.toISOString(),
      period: {
        key: range,
        label: periodLabel(range),
        start: start.toISOString(),
        endExclusive: end.toISOString(),
      },
      summary: {
        invoicedAmount: moneyNumber(invoiceAggregate._sum.totalAmount),
        invoiceCount: invoiceAggregate._count._all,
        collectedAmount: moneyNumber(paymentAggregate._sum.amount),
        paymentCount: paymentAggregate._count._all,
        outstandingAmount: moneyNumber(outstandingAggregate._sum.balanceAmount),
        outstandingInvoiceCount: outstandingAggregate._count._all,
        pendingQuotationCount,
        pendingQuotationAmount: moneyNumber(pendingQuotationAggregate._sum.totalAmount),
      },
      salesTrend: chart,
      quotationStatuses,
      serviceRevenue,
      outstandingInvoices: outstandingRows.map((invoice) => ({
        ...invoice,
        totalAmount: moneyNumber(invoice.totalAmount),
        paidAmount: moneyNumber(invoice.paidAmount),
        balanceAmount: moneyNumber(invoice.balanceAmount),
        iqamaNo: invoice.quotation.customer.iqamaNo,
      })),
      recentPayments: recentPaymentRows.map((payment) => ({
        ...payment,
        amount: moneyNumber(payment.amount),
        iqamaNo: payment.invoice.quotation.customer.iqamaNo,
      })),
      acceptedQuotations: acceptedQuotationRows.map((quotation) => ({
        ...quotation,
        totalAmount: moneyNumber(quotation.totalAmount),
        iqamaNo: quotation.customer.iqamaNo,
      })),
    });
  } catch (error) {
    console.error("Dashboard GET error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load dashboard data." },
      { status: 500 }
    );
  }
}
