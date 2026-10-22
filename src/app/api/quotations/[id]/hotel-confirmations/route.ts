import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  HotelConfirmationStatus,
  Prisma,
  ServiceType,
} from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type CreateConfirmationBody = {
  quotationItemId?: unknown;
  hotelConfirmationNumber?: unknown;
  status?: unknown;
  checkIn?: unknown;
  checkOut?: unknown;
  termsConditionIds?: unknown;
  notes?: unknown;
};

function parsePositiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return date;
}

function createReceiptNo(): string {
  const year = new Date().getFullYear();
  const uniquePart = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

  return `HCR-${year}-${uniquePart}`;
}

function isValidStatus(
  value: string,
): value is "TENTATIVE" | "DEFINITE" {
  return value === "TENTATIVE" || value === "DEFINITE";
}

async function getTermsSnapshots(value: unknown) {
  const ids = Array.isArray(value) ? value.map(Number) : [];

  if (
    ids.some((id) => !Number.isInteger(id) || id <= 0) ||
    new Set(ids).size !== ids.length
  ) {
    return {
      error: "Select valid hotel Terms & Conditions templates.",
      snapshots: null,
    };
  }

  if (ids.length === 0) {
    return { error: null, snapshots: [] };
  }

  const terms = await prisma.quotationServiceTermsCondition.findMany({
    where: {
      id: { in: ids },
      serviceType: "HOTEL_ACCOMMODATION",
      isActive: true,
    },
    select: {
      id: true,
      serviceType: true,
      title: true,
      content: true,
    },
  });

  if (terms.length !== ids.length) {
    return {
      error:
        "One or more selected hotel Terms & Conditions templates are unavailable. Refresh and select them again.",
      snapshots: null,
    };
  }

  // Preserve the selection order and save the actual text,
  // so later template edits do not change an existing receipt.
  const snapshots = ids.map((id) => {
    const term = terms.find((row) => row.id === id)!;

    return {
      templateId: term.id,
      serviceType: term.serviceType,
      title: term.title,
      content: term.content,
    };
  });

  return { error: null, snapshots };
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );
    }

    const { id: idParam } = await context.params;
    const quotationId = parsePositiveId(idParam);

    if (!quotationId) {
      return NextResponse.json(
        { success: false, message: "Invalid quotation ID." },
        { status: 400 },
      );
    }

    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      select: { id: true, quotationNo: true },
    });

    if (!quotation) {
      return NextResponse.json(
        { success: false, message: "Quotation not found." },
        { status: 404 },
      );
    }

    const hotelConfirmations = await prisma.hotelConfirmation.findMany({
      where: { quotationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        receiptNo: true,
        hotelConfirmationNumber: true,
        quotationItemId: true,
        status: true,
        checkIn: true,
        checkOut: true,
        hotelName: true,
        roomType: true,
        numberOfDays: true,
        roomQuantity: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      quotation,
      hotelConfirmations,
    });
  } catch (error) {
    console.error("Hotel confirmations GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load hotel confirmations.",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );
    }

    const { id: idParam } = await context.params;
    const quotationId = parsePositiveId(idParam);

    if (!quotationId) {
      return NextResponse.json(
        { success: false, message: "Invalid quotation ID." },
        { status: 400 },
      );
    }

    let body: CreateConfirmationBody;

    try {
      body = (await request.json()) as CreateConfirmationBody;
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request body." },
        { status: 400 },
      );
    }

    const quotationItemId = parsePositiveId(body.quotationItemId);
    const hotelConfirmationNumber = cleanText(
      body.hotelConfirmationNumber,
    );
    const statusText = cleanText(body.status || "TENTATIVE");
    const checkIn = parseDate(body.checkIn);
    const checkOut = parseDate(body.checkOut);
    const notes = cleanText(body.notes);

    if (!quotationItemId) {
      return NextResponse.json(
        { success: false, message: "Select a hotel service." },
        { status: 400 },
      );
    }

    if (!hotelConfirmationNumber) {
      return NextResponse.json(
        {
          success: false,
          message: "The hotel's confirmation number is required.",
        },
        { status: 400 },
      );
    }

    if (!isValidStatus(statusText)) {
      return NextResponse.json(
        {
          success: false,
          message: "Choose Tentative Confirmation or Definite Confirmation.",
        },
        { status: 400 },
      );
    }

    if (!checkIn || !checkOut || checkOut <= checkIn) {
      return NextResponse.json(
        {
          success: false,
          message: "Enter valid check-in and check-out dates.",
        },
        { status: 400 },
      );
    }

    const termsResult = await getTermsSnapshots(body.termsConditionIds);

    if (termsResult.error || !termsResult.snapshots) {
      return NextResponse.json(
        {
          success: false,
          message: termsResult.error || "Invalid hotel terms selection.",
        },
        { status: 400 },
      );
    }

    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      select: {
        id: true,
        quotationNo: true,
        currency: true,
        customerName: true,
        customerMobile: true,
        customerWhatsapp: true,
        customerEmail: true,
        customerAddress: true,
        customerPassportNo: true,
        items: {
          where: {
            id: quotationItemId,
            serviceType: ServiceType.HOTEL_ACCOMMODATION,
          },
          select: {
            id: true,
            serviceType: true,
            description: true,
            hotelName: true,
            roomType: true,
            numberOfDays: true,
            quantity: true,
            paxCount: true,
            acType: true,
            boardType: true,
            amount: true,
            discount: true,
            totalAmount: true,
          },
        },
      },
    });

    if (!quotation) {
      return NextResponse.json(
        { success: false, message: "Quotation not found." },
        { status: 404 },
      );
    }

    const hotelItem = quotation.items[0];

    if (!hotelItem) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The selected service is not a hotel service in this quotation.",
        },
        { status: 400 },
      );
    }

    if (!hotelItem.hotelName?.trim() || !hotelItem.roomType?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The selected hotel service must have a hotel name and room type.",
        },
        { status: 400 },
      );
    }

    if (!hotelItem.numberOfDays || hotelItem.numberOfDays <= 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The selected hotel service must have a valid stay duration.",
        },
        { status: 400 },
      );
    }

    if (Number(hotelItem.quantity) <= 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The selected hotel service must have a valid room quantity.",
        },
        { status: 400 },
      );
    }

    const confirmation = await prisma.hotelConfirmation.create({
      data: {
        receiptNo: createReceiptNo(),
        hotelConfirmationNumber,
        status: statusText as HotelConfirmationStatus,
        checkIn,
        checkOut,

        customerName: quotation.customerName,
        customerMobile: quotation.customerMobile,
        customerWhatsapp: quotation.customerWhatsapp,
        customerEmail: quotation.customerEmail,
        customerAddress: quotation.customerAddress,
        customerPassportNo: quotation.customerPassportNo,

        hotelName: hotelItem.hotelName,
        roomType: hotelItem.roomType,
        numberOfDays: hotelItem.numberOfDays,
        roomQuantity: hotelItem.quantity,
        paxCount: hotelItem.paxCount,
        acType: hotelItem.acType,
        boardType: hotelItem.boardType,

        currency: quotation.currency,
        amount: hotelItem.amount,
        discount: hotelItem.discount,
        totalAmount: hotelItem.totalAmount,

        termsConditionsSnapshot:
          termsResult.snapshots as Prisma.InputJsonValue,
        notes: notes || null,

        quotationId: quotation.id,
        quotationItemId: hotelItem.id,
        createdById: userId,
      },
      include: {
        quotation: {
          select: { quotationNo: true },
        },
      },
    });

    await writeAuditLog({
      userId,
      module: "HOTEL_CONFIRMATION",
      action: "CREATE",
      entity: "HotelConfirmation",
      entityId: String(confirmation.id),
      description:
        `Created hotel confirmation ${confirmation.receiptNo} ` +
        `for quotation ${quotation.quotationNo}, hotel ${confirmation.hotelName}.`,
      metadata: {
        quotationId: quotation.id,
        quotationItemId: hotelItem.id,
        status: confirmation.status,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Hotel confirmation created successfully.",
        hotelConfirmation: confirmation,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Hotel confirmation POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create the hotel confirmation.",
      },
      { status: 500 },
    );
  }
}