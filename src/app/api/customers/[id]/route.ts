import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";

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

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireSession();
    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const { id: idParam } = await context.params;
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid customer ID." },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      return NextResponse.json(
        { success: false, message: "Customer not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, customer });
  } catch (error) {
    console.error("Customer GET error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load customer." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireSession();
    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const { id: idParam } = await context.params;
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid customer ID." },
        { status: 400 }
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

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Customer not found." },
        { status: 404 }
      );
    }

    const data: Prisma.CustomerUpdateInput = {};

    if ("name" in body) {
      const name = cleanString(body.name);
      if (!name) {
        return NextResponse.json(
          { success: false, message: "Customer name is required." },
          { status: 400 }
        );
      }
      data.name = name;
    }

    if ("mobile" in body) {
      const mobile = cleanString(body.mobile);
      if (!mobile) {
        return NextResponse.json(
          { success: false, message: "Contact number is required." },
          { status: 400 }
        );
      }
      data.mobile = mobile;
    }

    if ("iqamaNo" in body) data.iqamaNo = cleanString(body.iqamaNo);
    if ("whatsapp" in body) data.whatsapp = cleanString(body.whatsapp);
    if ("nationality" in body) data.nationality = cleanString(body.nationality);
    if ("notes" in body) data.notes = cleanString(body.notes);

    if ("isActive" in body) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json(
          { success: false, message: "isActive must be true or false." },
          { status: 400 }
        );
      }
      data.isActive = body.isActive;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, message: "No customer changes were supplied." },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.update({ where: { id }, data });

    const changedFields = Object.keys(data);
    const statusOnly = changedFields.length === 1 && changedFields[0] === "isActive";

    await writeAuditLog({
      userId: user.id,
      module: "CUSTOMER",
      action: statusOnly ? (customer.isActive ? "ACTIVATE" : "DEACTIVATE") : "UPDATE",
      entity: "Customer",
      entityId: String(customer.id),
      description: statusOnly
        ? `${customer.isActive ? "Activated" : "Deactivated"} customer ${customer.name}.`
        : `Updated customer ${customer.name}.`,
      metadata: {
        changedFields,
        customerCode: customer.customerCode,
      },
    });

    return NextResponse.json({
      success: true,
      message: statusOnly ? "Customer status updated successfully." : "Customer updated successfully.",
      customer,
    });
  } catch (error) {
    console.error("Customer PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to update customer." },
      { status: 500 }
    );
  }
}
