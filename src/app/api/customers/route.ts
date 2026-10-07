import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

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

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";

    const customers = await prisma.customer.findMany({
      where: search
        ? {
            OR: [
              {
                customerCode: {
                  contains: search,
                },
              },
              {
                name: {
                  contains: search,
                },
              },
              {
                mobile: {
                  contains: search,
                },
              },
              {
                whatsapp: {
                  contains: search,
                },
              },
              {
                passportNo: {
                  contains: search,
                },
              },
            ],
          }
        : undefined,
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      customers,
    });
  } catch (error) {
    console.error("Customers GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load customers.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();

    const name = cleanString(body.name);
    const mobile = cleanString(body.mobile);

    const whatsapp = cleanString(body.whatsapp);
    const email = cleanString(body.email);
    const address = cleanString(body.address);
    const nationality = cleanString(body.nationality);
    const passportNo = cleanString(body.passportNo);
    const notes = cleanString(body.notes);

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

    const result = await prisma.$transaction(async (tx) => {
      const temporaryCode = `TEMP-${randomUUID()}`;

      const customer = await tx.customer.create({
        data: {
          customerCode: temporaryCode,
          name,
          mobile,
          whatsapp,
          email,
          address,
          nationality,
          passportNo,
          notes,
          isActive: true,
        },
      });

      const customerCode = `CUS-${String(customer.id).padStart(5, "0")}`;

      return tx.customer.update({
        where: {
          id: customer.id,
        },
        data: {
          customerCode,
        },
      });
    });

    return NextResponse.json(
      {
        success: true,
        message: "Customer created successfully.",
        customer: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Customers POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create customer.",
      },
      { status: 500 }
    );
  }
}