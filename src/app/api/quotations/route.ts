
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

type IncomingItem = {
  serviceType: string;

  visaType?: string;

  hotelName?: string;
  paxCount?: number | string;
  acType?: string;
  boardType?: string;

  ticketType?: string;

  routeId?: number | string;
  vehicleTypeId?: number | string;

  amount?: number | string;
  quantity?: number | string;
  discount?: number | string;
};

const SERVICE_TYPES = new Set([
  "UMRAH_VISA",
  "HOTEL_ACCOMMODATION",
  "AIR_TICKET",
  "TRANSPORTATION",
]);

const VISA_TYPES = new Set([
  "GROUP",
  "INDIVIDUAL_VISA",
  "HOST_UMRAH_VISA",
]);

const AC_TYPES = new Set([
  "AC",
  "NON_AC",
]);

const BOARD_TYPES = new Set([
  "ROOM_ONLY",
  "BED_BREAKFAST",
]);

const TICKET_TYPES = new Set([
  "ONE_WAY",
  "RETURN",
]);

function cleanText(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function toNumber(value: unknown): number {
  const result = Number(value);

  return Number.isFinite(result)
    ? result
    : 0;
}

function toMoney(value: unknown): number {
  return Math.round(toNumber(value) * 100) / 100;
}

function calculateLineTotal(
  amount: number,
  quantity: number,
  discount: number
) {
  return Math.max(
    0,
    amount * quantity - discount
  );
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

function createTemporaryQuotationNo() {
  return `TEMP-${randomUUID()}`;
}

export async function POST(request: Request) {
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

    const body = await request.json();

    const customerId = Number(
      body.customerId
    );

    if (
      !Number.isInteger(customerId) ||
      customerId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Please select a customer.",
        },
        { status: 400 }
      );
    }

    const incomingItems = Array.isArray(
      body.items
    )
      ? (body.items as IncomingItem[])
      : [];

    if (incomingItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please add at least one service.",
        },
        { status: 400 }
      );
    }

    const customer =
      await prisma.customer.findFirst({
        where: {
          id: customerId,
          isActive: true,
        },
      });

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Customer not found or inactive.",
        },
        { status: 404 }
      );
    }

    const preparedItems: Array<{
      serviceType:
        | "UMRAH_VISA"
        | "HOTEL_ACCOMMODATION"
        | "AIR_TICKET"
        | "TRANSPORTATION";

      description: string;

      visaType?:
        | "GROUP"
        | "INDIVIDUAL_VISA"
        | "HOST_UMRAH_VISA";

      hotelName?: string;
      paxCount?: number;

      acType?: "AC" | "NON_AC";

      boardType?:
        | "ROOM_ONLY"
        | "BED_BREAKFAST";

      ticketType?:
        | "ONE_WAY"
        | "RETURN";

      routeId?: number;
      vehicleTypeId?: number;

      amount: string;
      quantity: string;
      discount: string;
      totalAmount: string;

      sortOrder: number;
    }> = [];

    let subtotalCents = 0;
    let totalDiscountCents = 0;
    let grandTotalCents = 0;

    for (
      let index = 0;
      index < incomingItems.length;
      index++
    ) {
      const item = incomingItems[index];

      if (
        !SERVICE_TYPES.has(
          item.serviceType
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message: `Invalid service type on item ${
              index + 1
            }.`,
          },
          { status: 400 }
        );
      }

      const amount = toMoney(item.amount);
      const quantity = toNumber(
        item.quantity
      );
      const discount = toMoney(
        item.discount
      );

      if (amount <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Amount must be greater than zero on item ${
              index + 1
            }.`,
          },
          { status: 400 }
        );
      }

      if (quantity <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Quantity must be greater than zero on item ${
              index + 1
            }.`,
          },
          { status: 400 }
        );
      }

      if (discount < 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Discount cannot be negative on item ${
              index + 1
            }.`,
          },
          { status: 400 }
        );
      }

      const lineSubtotal =
        amount * quantity;

      if (discount > lineSubtotal) {
        return NextResponse.json(
          {
            success: false,
            message: `Discount cannot exceed the item amount on item ${
              index + 1
            }.`,
          },
          { status: 400 }
        );
      }

      const lineTotal =
        calculateLineTotal(
          amount,
          quantity,
          discount
        );

      const serviceType =
        item.serviceType as
          | "UMRAH_VISA"
          | "HOTEL_ACCOMMODATION"
          | "AIR_TICKET"
          | "TRANSPORTATION";

      let description = "";

      let visaType:
        | "GROUP"
        | "INDIVIDUAL_VISA"
        | "HOST_UMRAH_VISA"
        | undefined;

      let hotelName: string | undefined;
      let paxCount: number | undefined;

      let acType:
        | "AC"
        | "NON_AC"
        | undefined;

      let boardType:
        | "ROOM_ONLY"
        | "BED_BREAKFAST"
        | undefined;

      let ticketType:
        | "ONE_WAY"
        | "RETURN"
        | undefined;

      let routeId: number | undefined;
      let vehicleTypeId: number | undefined;

      if (
        serviceType === "UMRAH_VISA"
      ) {
        const value = cleanText(
          item.visaType
        );

        if (!VISA_TYPES.has(value)) {
          return NextResponse.json(
            {
              success: false,
              message: `Invalid visa type on item ${
                index + 1
              }.`,
            },
            { status: 400 }
          );
        }

        visaType = value as
          | "GROUP"
          | "INDIVIDUAL_VISA"
          | "HOST_UMRAH_VISA";

        const visaLabel =
          visaType === "INDIVIDUAL_VISA"
            ? "Individual Visa"
            : visaType ===
                "HOST_UMRAH_VISA"
              ? "Host Umrah Visa"
              : "Group";

        description = `Umrah Visa - ${visaLabel}`;
      }

      if (
        serviceType ===
        "HOTEL_ACCOMMODATION"
      ) {
        hotelName = cleanText(
          item.hotelName
        );

        if (!hotelName) {
          return NextResponse.json(
            {
              success: false,
              message: `Hotel name is required on item ${
                index + 1
              }.`,
            },
            { status: 400 }
          );
        }

        paxCount = Number(
          item.paxCount
        );

        if (
          !Number.isInteger(paxCount) ||
          paxCount <= 0
        ) {
          return NextResponse.json(
            {
              success: false,
              message: `Pax count is required on item ${
                index + 1
              }.`,
            },
            { status: 400 }
          );
        }

        const acValue = cleanText(
          item.acType
        );

        const boardValue = cleanText(
          item.boardType
        );

        if (!AC_TYPES.has(acValue)) {
          return NextResponse.json(
            {
              success: false,
              message: `AC type is required on item ${
                index + 1
              }.`,
            },
            { status: 400 }
          );
        }

        if (
          !BOARD_TYPES.has(boardValue)
        ) {
          return NextResponse.json(
            {
              success: false,
              message: `Accommodation type is required on item ${
                index + 1
              }.`,
            },
            { status: 400 }
          );
        }

        acType = acValue as
          | "AC"
          | "NON_AC";

        boardType = boardValue as
          | "ROOM_ONLY"
          | "BED_BREAKFAST";

        const acLabel =
          acType === "AC"
            ? "AC"
            : "Non-AC";

        const boardLabel =
          boardType === "BED_BREAKFAST"
            ? "Bed & Breakfast"
            : "Room Only";

        description =
          `${hotelName} - ${paxCount} Pax - ${acLabel} - ${boardLabel}`;
      }

      if (
        serviceType ===
        "AIR_TICKET"
      ) {
        const value = cleanText(
          item.ticketType
        );

        if (
          !TICKET_TYPES.has(value)
        ) {
          return NextResponse.json(
            {
              success: false,
              message: `Ticket type is required on item ${
                index + 1
              }.`,
            },
            { status: 400 }
          );
        }

        ticketType = value as
          | "ONE_WAY"
          | "RETURN";

        description =
          ticketType === "RETURN"
            ? "Air Ticket - Return"
            : "Air Ticket - One Way";
      }

      if (
        serviceType ===
        "TRANSPORTATION"
      ) {
        routeId = Number(
          item.routeId
        );

        vehicleTypeId = Number(
          item.vehicleTypeId
        );

        if (
          !Number.isInteger(routeId) ||
          routeId <= 0
        ) {
          return NextResponse.json(
            {
              success: false,
              message: `Route is required on item ${
                index + 1
              }.`,
            },
            { status: 400 }
          );
        }

        if (
          !Number.isInteger(
            vehicleTypeId
          ) ||
          vehicleTypeId <= 0
        ) {
          return NextResponse.json(
            {
              success: false,
              message: `Vehicle type is required on item ${
                index + 1
              }.`,
            },
            { status: 400 }
          );
        }

        const [route, vehicle] =
          await Promise.all([
            prisma.route.findFirst({
              where: {
                id: routeId,
                isActive: true,
              },
            }),

            prisma.vehicleType.findFirst({
              where: {
                id: vehicleTypeId,
                isActive: true,
              },
            }),
          ]);

        if (!route) {
          return NextResponse.json(
            {
              success: false,
              message: `Selected route is unavailable on item ${
                index + 1
              }.`,
            },
            { status: 400 }
          );
        }

        if (!vehicle) {
          return NextResponse.json(
            {
              success: false,
              message: `Selected vehicle type is unavailable on item ${
                index + 1
              }.`,
            },
            { status: 400 }
          );
        }

        description =
          `${route.name} - ${vehicle.name}`;
      }

      const subtotalCentsForItem =
        Math.round(
          lineSubtotal * 100
        );

      const discountCentsForItem =
        Math.round(
          discount * 100
        );

      const totalCentsForItem =
        Math.round(
          lineTotal * 100
        );

      subtotalCents +=
        subtotalCentsForItem;

      totalDiscountCents +=
        discountCentsForItem;

      grandTotalCents +=
        totalCentsForItem;

      const preparedItem: {
        serviceType:
          | "UMRAH_VISA"
          | "HOTEL_ACCOMMODATION"
          | "AIR_TICKET"
          | "TRANSPORTATION";

        description: string;

        amount: string;
        quantity: string;
        discount: string;
        totalAmount: string;

        sortOrder: number;

        visaType?:
          | "GROUP"
          | "INDIVIDUAL_VISA"
          | "HOST_UMRAH_VISA";

        hotelName?: string;
        paxCount?: number;

        acType?:
          | "AC"
          | "NON_AC";

        boardType?:
          | "ROOM_ONLY"
          | "BED_BREAKFAST";

        ticketType?:
          | "ONE_WAY"
          | "RETURN";

        routeId?: number;
        vehicleTypeId?: number;
      } = {
        serviceType,
        description,

        amount: formatMoney(amount),
        quantity: quantity.toFixed(2),
        discount: formatMoney(discount),
        totalAmount: formatMoney(
          lineTotal
        ),

        sortOrder: index,
      };

      if (visaType) {
        preparedItem.visaType =
          visaType;
      }

      if (hotelName) {
        preparedItem.hotelName =
          hotelName;
      }

      if (paxCount !== undefined) {
        preparedItem.paxCount =
          paxCount;
      }

      if (acType) {
        preparedItem.acType =
          acType;
      }

      if (boardType) {
        preparedItem.boardType =
          boardType;
      }

      if (ticketType) {
        preparedItem.ticketType =
          ticketType;
      }

      if (routeId !== undefined) {
        preparedItem.routeId =
          routeId;
      }

      if (
        vehicleTypeId !== undefined
      ) {
        preparedItem.vehicleTypeId =
          vehicleTypeId;
      }

      preparedItems.push(preparedItem);
    }

    const result =
      await prisma.$transaction(
        async (tx) => {
          const quotation =
            await tx.quotation.create({
              data: {
                quotationNo:
                  createTemporaryQuotationNo(),

                customerId,

                quotationDate:
                  new Date(),

                customerName:
                  customer.name,

                customerMobile:
                  customer.mobile,

                customerWhatsapp:
                  customer.whatsapp,

                customerEmail:
                  customer.email,

                customerAddress:
                  customer.address,

                customerNationality:
                  customer.nationality,

                customerPassportNo:
                  customer.passportNo,

                subtotal:
                  formatMoney(
                    subtotalCents / 100
                  ),

                discount:
                  formatMoney(
                    totalDiscountCents / 100
                  ),

                totalAmount:
                  formatMoney(
                    grandTotalCents / 100
                  ),

                status: "GENERATED",

                createdById: userId,

                items: {
                  create:
                    preparedItems.map(
                      (item) => ({
                        serviceType:
                          item.serviceType,

                        description:
                          item.description,

                        visaType:
                          item.visaType,

                        hotelName:
                          item.hotelName,

                        paxCount:
                          item.paxCount,

                        acType:
                          item.acType,

                        boardType:
                          item.boardType,

                        ticketType:
                          item.ticketType,

                        routeId:
                          item.routeId,

                        vehicleTypeId:
                          item.vehicleTypeId,

                        amount:
                          item.amount,

                        quantity:
                          item.quantity,

                        discount:
                          item.discount,

                        totalAmount:
                          item.totalAmount,

                        sortOrder:
                          item.sortOrder,
                      })
                    ),
                },
              },

              include: {
                customer: true,

                items: {
                  orderBy: {
                    sortOrder: "asc",
                  },

                  include: {
                    route: true,
                    vehicleType: true,
                  },
                },
              },
            });

          const year =
            quotation.quotationDate.getFullYear();

          const quotationNo =
            `QT-${year}-${String(
              quotation.id
            ).padStart(5, "0")}`;

          return tx.quotation.update({
            where: {
              id: quotation.id,
            },

            data: {
              quotationNo,
            },

            include: {
              customer: true,

              items: {
                orderBy: {
                  sortOrder: "asc",
                },

                include: {
                  route: true,
                  vehicleType: true,
                },
              },
            },
          });
        }
      );

      await writeAuditLog({
  userId,
  module: "QUOTATION",
  action: "CREATE",
  entity: "Quotation",
  entityId: String(result.id),
  description: `Created quotation ${result.quotationNo} for ${customer.name}.`,
  metadata: {
    quotationNo: result.quotationNo,
    customerId: customer.id,
    totalAmount: result.totalAmount.toString(),
    itemCount: result.items.length,
  },
});

    return NextResponse.json(
      {
        success: true,
        message:
          "Quotation generated successfully.",
        quotation: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Quotation POST error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to generate quotation.",
      },
      { status: 500 }
    );
  }
}