import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

async function requireSession() {
  const userId = await getSessionUserId();
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true },
  });
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function GET(request: Request) {
  try {
    const user = await requireSession();

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";

    const customers = await prisma.customer.findMany({
      where: search
        ? {
            OR: [
              { customerCode: { contains: search } },
              { name: { contains: search } },
              { mobile: { contains: search } },
              { whatsapp: { contains: search } },
              { iqamaNo: { contains: search } },
              { nationality: { contains: search } },
              { notes: { contains: search } },
              // Keep old customer passport values searchable for legacy records.
              { passportNo: { contains: search } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
    });

    await writeAuditLog({
      userId: user.id,
      module: "CUSTOMER",
      action: "LIST",
      entity: "Customer",
      description: "Viewed customer list.",
      metadata: { search: search || null, resultCount: customers.length },
    });

    return NextResponse.json({ success: true, customers });
  } catch (error) {
    console.error("Customers GET error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load customers." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSession();

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const name = cleanString(body.name);
    const mobile = cleanString(body.mobile);
    const iqamaNo = cleanString(body.iqamaNo);
    const whatsapp = cleanString(body.whatsapp);
    const nationality = cleanString(body.nationality);
    const notes = cleanString(body.notes);

    if (!name) {
      return NextResponse.json(
        { success: false, message: "Customer name is required." },
        { status: 400 }
      );
    }

    if (!mobile) {
      return NextResponse.json(
        { success: false, message: "Contact number is required." },
        { status: 400 }
      );
    }

    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          customerCode: `TEMP-${randomUUID()}`,
          name,
          mobile,
          whatsapp,
          iqamaNo,
          nationality,
          notes,
          isActive: true,
        },
      });

      return tx.customer.update({
        where: { id: created.id },
        data: { customerCode: `CUS-${String(created.id).padStart(5, "0")}` },
      });
    });

    await writeAuditLog({
      userId: user.id,
      module: "CUSTOMER",
      action: "CREATE",
      entity: "Customer",
      entityId: String(customer.id),
      description: `Created customer ${customer.name}.`,
      metadata: {
        customerCode: customer.customerCode,
        mobile: customer.mobile,
        iqamaNo: customer.iqamaNo,
      },
    });

    return NextResponse.json(
      { success: true, message: "Customer created successfully.", customer },
      { status: 201 }
    );
  } catch (error) {
    console.error("Customers POST error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to create customer." },
      { status: 500 }
    );
  }
}
