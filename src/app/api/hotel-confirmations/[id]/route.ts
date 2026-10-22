import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  HotelConfirmationStatus,
  Prisma,
} from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UpdateConfirmationBody = {
  hotelConfirmationNumber?: unknown;
  status?: unknown;
  checkIn?: unknown;
  checkOut?: unknown;
  termsConditionIds?: unknown;
  notes?: unknown;
};

function parseId(value: unknown): number | null {
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
        "One or more selected hotel Terms & Conditions templates are unavailable.",
      snapshots: null,
    };
  }

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
    const id = parseId(idParam);

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Invalid hotel confirmation ID." },
        { status: 400 },
      );
    }

    const hotelConfirmation = await prisma.hotelConfirmation.findUnique({
      where: { id },
      include: {
        quotation: {
          select: {
            id: true,
            quotationNo: true,
            quotationDate: true,
            currency: true,
          },
        },
        quotationItem: {
          select: {
            id: true,
            description: true,
            serviceType: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!hotelConfirmation) {
      return NextResponse.json(
        { success: false, message: "Hotel confirmation not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      hotelConfirmation,
    });
  } catch (error) {
    console.error("Hotel confirmation GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load the hotel confirmation.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
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
    const id = parseId(idParam);

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Invalid hotel confirmation ID." },
        { status: 400 },
      );
    }

    let body: UpdateConfirmationBody;

    try {
      body = (await request.json()) as UpdateConfirmationBody;
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request body." },
        { status: 400 },
      );
    }

    const existing = await prisma.hotelConfirmation.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Hotel confirmation not found." },
        { status: 404 },
      );
    }

    const data: Prisma.HotelConfirmationUpdateInput = {};

    if (body.status !== undefined) {
      const statusText = cleanText(body.status);

      if (!isValidStatus(statusText)) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Choose Tentative Confirmation or Definite Confirmation.",
          },
          { status: 400 },
        );
      }

      data.status = statusText as HotelConfirmationStatus;
    }

    if (body.hotelConfirmationNumber !== undefined) {
      const confirmationNumber = cleanText(
        body.hotelConfirmationNumber,
      );

      if (!confirmationNumber) {
        return NextResponse.json(
          {
            success: false,
            message: "The hotel's confirmation number is required.",
          },
          { status: 400 },
        );
      }

      data.hotelConfirmationNumber = confirmationNumber;
    }

    const checkIn =
      body.checkIn === undefined
        ? existing.checkIn
        : parseDate(body.checkIn);

    const checkOut =
      body.checkOut === undefined
        ? existing.checkOut
        : parseDate(body.checkOut);

    if (!checkIn || !checkOut || checkOut <= checkIn) {
      return NextResponse.json(
        {
          success: false,
          message: "Enter valid check-in and check-out dates.",
        },
        { status: 400 },
      );
    }

    if (body.checkIn !== undefined) {
      data.checkIn = checkIn;
    }

    if (body.checkOut !== undefined) {
      data.checkOut = checkOut;
    }

    if (body.notes !== undefined) {
      if (
        body.notes !== null &&
        typeof body.notes !== "string"
      ) {
        return NextResponse.json(
          { success: false, message: "Notes must be text." },
          { status: 400 },
        );
      }

      data.notes =
        typeof body.notes === "string" && body.notes.trim()
          ? body.notes.trim()
          : null;
    }

    if (body.termsConditionIds !== undefined) {
      const termsResult = await getTermsSnapshots(
        body.termsConditionIds,
      );

      if (termsResult.error || !termsResult.snapshots) {
        return NextResponse.json(
          {
            success: false,
            message:
              termsResult.error || "Invalid hotel terms selection.",
          },
          { status: 400 },
        );
      }

      data.termsConditionsSnapshot =
        termsResult.snapshots as Prisma.InputJsonValue;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No confirmation changes were provided.",
        },
        { status: 400 },
      );
    }

    const hotelConfirmation = await prisma.hotelConfirmation.update({
      where: { id },
      data,
      include: {
        quotation: {
          select: {
            id: true,
            quotationNo: true,
            currency: true,
          },
        },
        quotationItem: {
          select: {
            id: true,
            description: true,
            serviceType: true,
          },
        },
      },
    });

    await writeAuditLog({
      userId,
      module: "HOTEL_CONFIRMATION",
      action: "UPDATE",
      entity: "HotelConfirmation",
      entityId: String(hotelConfirmation.id),
      description:
        `Updated hotel confirmation ${hotelConfirmation.receiptNo}.`,
      metadata: {
        previousStatus: existing.status,
        newStatus: hotelConfirmation.status,
        receiptNo: hotelConfirmation.receiptNo,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Hotel confirmation updated successfully.",
      hotelConfirmation,
    });
  } catch (error) {
    console.error("Hotel confirmation PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update the hotel confirmation.",
      },
      { status: 500 },
    );
  }
}