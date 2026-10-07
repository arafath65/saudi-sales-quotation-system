import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

async function requireSession() {
  const userId = await getSessionUserId();

  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      role: true,
      isActive: true,
    },
  });
}

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

async function getId(params: Promise<{ id: string }>) {
  const { id } = await params;

  const parsed = Number(id);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSession();

    if (!user || !user.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const id = await getId(params);

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid customer ID.",
        },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: {
        id,
      },
    });

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      customer,
    });
  } catch (error) {
    console.error("Customer GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load customer.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSession();

    if (!user || !user.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const id = await getId(params);

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid customer ID.",
        },
        { status: 400 }
      );
    }

    const existing = await prisma.customer.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer not found.",
        },
        { status: 404 }
      );
    }

    const body = await request.json();

    const name = cleanString(body.name);
    const mobile = cleanString(body.mobile);

    const whatsapp = cleanString(body.whatsapp);
    const email = cleanString(body.email);
    const address = cleanString(body.address);
    const nationality = cleanString(body.nationality);
    const passportNo = cleanString(body.passportNo);
    const notes = cleanString(body.notes);

    const isActive =
      typeof body.isActive === "boolean"
        ? body.isActive
        : existing.isActive;

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer name is required.",
        },
        { status: 400 }
      );
    }

    if (!mobile) {
      return NextResponse.json(
        {
          success: false,
          message: "Mobile number is required.",
        },
        { status: 400 }
      );
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        {
          success: false,
          message: "Please enter a valid email address.",
        },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.update({
      where: {
        id,
      },
      data: {
        name,
        mobile,
        whatsapp,
        email,
        address,
        nationality,
        passportNo,
        notes,
        isActive,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Customer updated successfully.",
      customer,
    });
  } catch (error) {
    console.error("Customer PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update customer.",
      },
      { status: 500 }
    );
  }
}