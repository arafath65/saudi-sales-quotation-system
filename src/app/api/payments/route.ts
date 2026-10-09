import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { PaymentMethod, Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE_DEFAULT = 10;
const MAX_PAGE_SIZE = 50;

const DATE_RANGES = new Set([
  "THIS_MONTH",
  "LAST_MONTH",
  "LAST_3_MONTHS",
  "LAST_6_MONTHS",
  "LAST_1_YEAR",
  "ALL_TIME",
]);

function getColomboDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function dateString(year: number, monthIndex: number, day = 1) {
  const date = new Date(Date.UTC(year, monthIndex, day));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function startOfColomboDay(value: string) {
  return new Date(`${value}T00:00:00+05:30`);
}

function getDateFilter(range: string): Prisma.DateTimeFilter | undefined {
  if (range === "ALL_TIME") return undefined;

  const today = getColomboDateParts(new Date());
  const currentMonthStart = dateString(today.year, today.month - 1, 1);
  const tomorrow = dateString(today.year, today.month - 1, today.day + 1);

  let start: string;
  let end: string;

  switch (range) {
    case "LAST_MONTH":
      start = dateString(today.year, today.month - 2, 1);
      end = currentMonthStart;
      break;
    case "LAST_3_MONTHS":
      start = dateString(today.year, today.month - 3, 1);
      end = tomorrow;
      break;
    case "LAST_6_MONTHS":
      start = dateString(today.year, today.month - 6, 1);
      end = tomorrow;
      break;
    case "LAST_1_YEAR":
      start = dateString(today.year, today.month - 12, 1);
      end = tomorrow;
      break;
    case "THIS_MONTH":
    default:
      start = currentMonthStart;
      end = tomorrow;
      break;
  }

  return {
    gte: startOfColomboDay(start),
    lt: startOfColomboDay(end),
  };
}

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
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
    const search = (searchParams.get("search") ?? "").trim();
    const rangeParam = (searchParams.get("range") ?? "THIS_MONTH").trim();
    const range = DATE_RANGES.has(rangeParam) ? rangeParam : "THIS_MONTH";
    const methodParam = (searchParams.get("method") ?? "ALL").trim();
    const pageRequested = parsePositiveInteger(searchParams.get("page"), 1);
    const pageSizeRequested = parsePositiveInteger(
      searchParams.get("pageSize"),
      PAGE_SIZE_DEFAULT
    );
    const pageSize = Math.min(pageSizeRequested, MAX_PAGE_SIZE);

    const where: Prisma.PaymentWhereInput = {};
    const paymentDate = getDateFilter(range);

    if (paymentDate) {
      where.paymentDate = paymentDate;
    }

    if (Object.values(PaymentMethod).includes(methodParam as PaymentMethod)) {
      where.method = methodParam as PaymentMethod;
    }

    if (search) {
      where.OR = [
        { invoice: { is: { invoiceNo: { contains: search } } } },
        { invoice: { is: { customerName: { contains: search } } } },
        { invoice: { is: { customerMobile: { contains: search } } } },
        { referenceNo: { contains: search } },
        { notes: { contains: search } },
      ];
    }

    const [totalCount, aggregate] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const page = Math.min(pageRequested, totalPages);

    const payments = await prisma.payment.findMany({
      where,
      orderBy: [{ paymentDate: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        invoiceId: true,
        paymentDate: true,
        amount: true,
        method: true,
        referenceNo: true,
        notes: true,
        createdAt: true,
        invoice: {
          select: {
            id: true,
            invoiceNo: true,
            customerId: true,
            customerName: true,
            customerMobile: true,
            totalAmount: true,
            paidAmount: true,
            balanceAmount: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });

    const totalAmount = Number(aggregate._sum.amount ?? 0);

    await writeAuditLog({
      userId: user.id,
      module: "PAYMENT",
      action: "LIST",
      entity: "Payment",
      description: `Viewed payment register for ${range.toLowerCase().replaceAll("_", " ")}${search ? ` searching "${search}"` : ""}.`,
      metadata: {
        search: search || null,
        range,
        method: methodParam === "ALL" ? null : methodParam,
        page,
        pageSize,
        resultCount: totalCount,
        totalAmount,
      },
    });

    return NextResponse.json({
      success: true,
      payments,
      summary: {
        count: totalCount,
        totalAmount,
      },
      pagination: {
        page,
        pageSize,
        totalPages,
        totalCount,
      },
    });
  } catch (error) {
    console.error("Payment LIST error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load payments." },
      { status: 500 }
    );
  }
}
