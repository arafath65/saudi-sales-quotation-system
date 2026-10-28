import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentQuotationDate } from "@/lib/quotation-expiry";

type ServiceType =
  | "UMRAH_VISA"
  | "RAWDHA"
  | "HOTEL_ACCOMMODATION"
  | "AIR_TICKET"
  | "TRANSPORTATION";

  type TermsConditionSelectionInput = {
  serviceType?: unknown;
  termsConditionId?: unknown;
};

type IncomingItem = {
  serviceType: string;
  additionalDescription?: string;
  visaType?: string;
  hotelName?: string;
  roomType?: string;
  numberOfDays?: number | string;
  paxCount?: number | string;
  acType?: string;
  boardType?: string;
  ticketType?: string;
  airlineName?: string;
  baggageWeightKg?: number | string;
  adultPrice?: number | string;
  adultQuantity?: number | string;
  childPrice?: number | string;
  childQuantity?: number | string;
  infantPrice?: number | string;
  infantQuantity?: number | string;
  routeId?: number | string;
  vehicleTypeId?: number | string;
  amount?: number | string;
  quantity?: number | string;
  discount?: number | string;
};

type PreparedItem = {
  serviceType: ServiceType;
  description: string;
  visaType?: "GROUP" | "INDIVIDUAL_VISA" | "HOST_UMRAH_VISA";
  hotelName?: string;
  roomType?: string;
  numberOfDays?: number;
  paxCount?: number;
  acType?: "AC" | "NON_AC";
  boardType?: "ROOM_ONLY" | "BED_BREAKFAST";
  ticketType?: "ONE_WAY" | "RETURN";
  airlineName?: string;
  baggageWeightKg?: string;
  adultPrice?: string;
  adultQuantity?: number;
  childPrice?: string;
  childQuantity?: number;
  infantPrice?: string;
  infantQuantity?: number;
  routeId?: number;
  vehicleTypeId?: number;
  amount: string;
  quantity: string;
  discount: string;
  totalAmount: string;
  sortOrder: number;
};

const SERVICE_TYPES = new Set<string>([
  "UMRAH_VISA",
  "RAWDHA",
  "HOTEL_ACCOMMODATION",
  "AIR_TICKET",
  "TRANSPORTATION",
]);

const VISA_TYPES = new Set<string>([
  "GROUP",
  "INDIVIDUAL_VISA",
  "HOST_UMRAH_VISA",
]);

const BOARD_TYPES = new Set<string>(["ROOM_ONLY", "BED_BREAKFAST"]);
const TICKET_TYPES = new Set<string>(["ONE_WAY", "RETURN"]);

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;

  const result = Number(value);

  return Number.isFinite(result) ? result : Number.NaN;
}

function toMoney(value: unknown): number {
  const result = toNumber(value);

  return Number.isFinite(result)
    ? Math.round(result * 100) / 100
    : Number.NaN;
}

function formatMoney(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function createTemporaryQuotationNo(): string {
  return `TEMP-${randomUUID()}`;
}

function getPassengerValue(
  item: IncomingItem,
  priceKey: "adultPrice" | "childPrice" | "infantPrice",
  quantityKey: "adultQuantity" | "childQuantity" | "infantQuantity",
): { price: number; quantity: number } {
  const rawPrice = item[priceKey];
  const rawQuantity = item[quantityKey];

  const quantity =
    rawQuantity === undefined ? 0 : toNumber(rawQuantity);

  const price =
    rawPrice === undefined || rawPrice === ""
      ? 0
      : toMoney(rawPrice);

  return { price, quantity };
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    let body: {
  customerId?: unknown;
  currency?: unknown;
  validUntil?: unknown;
  items?: unknown;
  selectedBankIds?: unknown;
  termsConditionSelections?: unknown;
};

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const customerId = Number(body.customerId);

    const currencyValue = cleanText(body.currency || "SAR");

const allowedCurrencies = new Set(["SAR", "LKR", "USD"]);

if (!allowedCurrencies.has(currencyValue)) {
  return NextResponse.json(
    {
      success: false,
      message: "Please select a valid currency: SAR, LKR, or USD.",
    },
    { status: 400 }
  );
}

const currency = currencyValue as "SAR" | "LKR" | "USD";

    const validUntilText =
  typeof body.validUntil === "string"
    ? body.validUntil.trim()
    : "";

if (!/^\d{4}-\d{2}-\d{2}$/.test(validUntilText)) {
  return NextResponse.json(
    {
      success: false,
      message: "Please select a valid quotation expiry date.",
    },
    { status: 400 }
  );
}

const validUntilDate = new Date(
  `${validUntilText}T00:00:00.000Z`
);

if (
  Number.isNaN(validUntilDate.getTime()) ||
  validUntilDate.toISOString().slice(0, 10) !== validUntilText
) {
  return NextResponse.json(
    {
      success: false,
      message: "Please select a valid quotation expiry date.",
    },
    { status: 400 }
  );
}

if (validUntilText < getCurrentQuotationDate()) {
  return NextResponse.json(
    {
      success: false,
      message: "Valid Until cannot be earlier than today.",
    },
    { status: 400 }
  );
}

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return NextResponse.json(
        { success: false, message: "Please select a customer." },
        { status: 400 }
      );
    }

    const incomingItems = Array.isArray(body.items)
      ? (body.items as IncomingItem[])
      : [];

    if (incomingItems.length === 0) {
      return NextResponse.json(
        { success: false, message: "Please add at least one service." },
        { status: 400 }
      );
    }

    
    // Bank accounts are optional. A quotation may have zero, one, or two.
    const selectedBankIds = Array.isArray(body.selectedBankIds)
      ? body.selectedBankIds.map((value) => Number(value))
      : [];

    if (
      selectedBankIds.length > 2 ||
      selectedBankIds.some(
        (id) => !Number.isInteger(id) || id <= 0
      ) ||
      new Set(selectedBankIds).size !== selectedBankIds.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Select up to two different valid bank accounts, or leave them unselected.",
        },
        { status: 400 }
      );
    }

    const selectedBanks = selectedBankIds.length
      ? await prisma.quotationBankDetail.findMany({
          where: {
            id: { in: selectedBankIds },
          },
        })
      : [];

    if (
      selectedBanks.length !== selectedBankIds.length ||
      selectedBanks.some(
        (bank) =>
          !bank.bankName.trim() ||
          !bank.accountName.trim() ||
          !bank.accountNumber.trim()
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "One or more selected bank accounts are unavailable. Refresh and choose valid accounts, or leave them unselected.",
        },
        { status: 400 }
      );
    }

    // Save values, not database IDs, as historical snapshots.
    const selectedBankSnapshots = selectedBanks
      .sort((a, b) => a.slot - b.slot)
      .map((bank) => ({
        bankName: bank.bankName,
        accountName: bank.accountName,
        accountNumber: bank.accountNumber,
        iban: bank.iban,
        swiftCode: bank.swiftCode,
        branchName: bank.branchName,
      }));

    const requestedTerms = Array.isArray(
      body.termsConditionSelections
    )
      ? (
          body.termsConditionSelections as
            TermsConditionSelectionInput[]
        )
      : [];

    const quotationServiceTypes = new Set(
      incomingItems
        .map((item) => cleanText(item?.serviceType))
        .filter((type) => SERVICE_TYPES.has(type))
    );

    const termsSelections = requestedTerms.map(
      (selection) => ({
        serviceType: cleanText(selection?.serviceType),
        termsConditionId: toNumber(
          selection?.termsConditionId
        ),
      })
    );

    if (
      termsSelections.some(
        (selection) =>
          !SERVICE_TYPES.has(selection.serviceType) ||
          !quotationServiceTypes.has(selection.serviceType) ||
          !Number.isInteger(
            selection.termsConditionId
          ) ||
          selection.termsConditionId <= 0
      ) ||
      new Set(
        termsSelections.map(
          (selection) => selection.serviceType
        )
      ).size !== termsSelections.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Select at most one valid terms template for each service included in the quotation.",
        },
        { status: 400 }
      );
    }

    const selectedTerms = termsSelections.length
      ? await prisma.quotationServiceTermsCondition.findMany({
          where: {
            id: {
              in: termsSelections.map(
                (selection) =>
                  selection.termsConditionId
              ),
            },
            isActive: true,
          },
        })
      : [];

    if (selectedTerms.length !== termsSelections.length) {
      return NextResponse.json(
        {
          success: false,
          message:
            "One or more selected Terms & Conditions templates are unavailable. Refresh and select them again.",
        },
        { status: 400 }
      );
    }

    const serviceLabels: Record<string, string> = {
      UMRAH_VISA: "Umrah Visa",
      RAWDHA: "Rawdha",
      HOTEL_ACCOMMODATION: "Hotel Accommodation",
      AIR_TICKET: "Air Ticket",
      TRANSPORTATION: "Transportation",
    };

    const termsMatchServices = termsSelections.every(
      (selection) => {
        const term = selectedTerms.find(
          (row) =>
            row.id === selection.termsConditionId
        );

        return Boolean(
          term &&
          term.serviceType === selection.serviceType
        );
      }
    );

    if (!termsMatchServices) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Each selected Terms & Conditions template must match its service type.",
        },
        { status: 400 }
      );
    }

    const selectedTermsSnapshots = termsSelections.map(
      (selection) => {
        const term = selectedTerms.find(
          (row) =>
            row.id === selection.termsConditionId
        )!;

        return {
          serviceType: term.serviceType,
          serviceLabel:
            serviceLabels[term.serviceType] ??
            term.serviceType,
          title: term.title,
          content: term.content,
        };
      }
    );


    const customer = await prisma.customer.findFirst({
      where: { id: customerId, isActive: true },
    });

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer not found or inactive.",
        },
        { status: 404 }
      );
    }

    const preparedItems: PreparedItem[] = [];

    let subtotalCents = 0;
    let totalDiscountCents = 0;
    let grandTotalCents = 0;

    for (let index = 0; index < incomingItems.length; index++) {
      const item = incomingItems[index];
      const itemNumber = index + 1;

      if (!item || !SERVICE_TYPES.has(item.serviceType)) {
        return NextResponse.json(
          {
            success: false,
            message: `Invalid service type on item ${itemNumber}.`,
          },
          { status: 400 }
        );
      }

      const serviceType = item.serviceType as ServiceType;
      const discount = toMoney(item.discount ?? 0);

      if (!Number.isFinite(discount) || discount < 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Discount must be a valid non-negative amount on item ${itemNumber}.`,
          },
          { status: 400 }
        );
      }

      let amount = toMoney(item.amount);
      let quantity = toNumber(item.quantity);
      let lineSubtotal = 0;
      let description = "";

      let visaType: PreparedItem["visaType"];
      let hotelName: string | undefined;
      let roomType: string | undefined;
      let numberOfDays: number | undefined;
      let paxCount: number | undefined;
      let acType: PreparedItem["acType"];
      let boardType: PreparedItem["boardType"];
      let ticketType: PreparedItem["ticketType"];
      let airlineName: string | undefined;
      let baggageWeightKg: string | undefined;
      let adultPrice: string | undefined;
      let adultQuantity: number | undefined;
      let childPrice: string | undefined;
      let childQuantity: number | undefined;
      let infantPrice: string | undefined;
      let infantQuantity: number | undefined;
      let routeId: number | undefined;
      let vehicleTypeId: number | undefined;

      if (serviceType === "UMRAH_VISA") {
        const value = cleanText(item.visaType);

        if (!VISA_TYPES.has(value)) {
          return NextResponse.json(
            {
              success: false,
              message: `Invalid visa type on item ${itemNumber}.`,
            },
            { status: 400 }
          );
        }

        visaType = value as NonNullable<PreparedItem["visaType"]>;

        const visaLabel =
          visaType === "INDIVIDUAL_VISA"
            ? "Individual Visa"
            : visaType === "HOST_UMRAH_VISA"
              ? "Host Umrah Visa"
              : "Group";

        description = `Umrah Visa - ${visaLabel}`;
      }

      if (serviceType === "RAWDHA") {
  description = "Rawdha";
}

      if (serviceType === "HOTEL_ACCOMMODATION") {
        hotelName = cleanText(item.hotelName);
        roomType = cleanText(item.roomType);
        numberOfDays = Number(item.numberOfDays);

        if (!hotelName) {
          return NextResponse.json(
            {
              success: false,
              message: `Hotel name is required on item ${itemNumber}.`,
            },
            { status: 400 }
          );
        }

        if (!roomType) {
          return NextResponse.json(
            {
              success: false,
              message: `Room type is required on item ${itemNumber}.`,
            },
            { status: 400 }
          );
        }

        if (!Number.isSafeInteger(numberOfDays) || numberOfDays <= 0) {
          return NextResponse.json(
            {
              success: false,
              message: `A valid number of days is required on item ${itemNumber}.`,
            },
            { status: 400 }
          );
        }

        const [activeRoomType, activeDuration] = await Promise.all([
          prisma.hotelRoomType.findFirst({
            where: { name: roomType, isActive: true },
            select: { id: true },
          }),
          prisma.hotelStayDuration.findFirst({
            where: { days: numberOfDays, isActive: true },
            select: { id: true },
          }),
        ]);

        if (!activeRoomType) {
          return NextResponse.json(
            {
              success: false,
              message: `Selected room type is unavailable on item ${itemNumber}.`,
            },
            { status: 400 }
          );
        }

        if (!activeDuration) {
          return NextResponse.json(
            {
              success: false,
              message: `Selected stay duration is unavailable on item ${itemNumber}.`,
            },
            { status: 400 }
          );
        }

        const boardValue = cleanText(item.boardType);

        if (!BOARD_TYPES.has(boardValue)) {
          return NextResponse.json(
            {
              success: false,
              message: `Accommodation type is required on item ${itemNumber}.`,
            },
            { status: 400 }
          );
        }

        // Saudi hotel accommodation is treated as air-conditioned by default.
        // Keep the existing nullable enum column populated for compatibility,
        // but do not ask users to choose AC / Non-AC or show it in the description.
        acType = "AC";
        boardType = boardValue as NonNullable<PreparedItem["boardType"]>;

        description = [
          hotelName,
          roomType,
          `${numberOfDays} ${numberOfDays === 1 ? "day" : "days"}`,
          boardType === "BED_BREAKFAST" ? "Bed & Breakfast" : "Room Only",
        ].join(" · ");
      }

      if (serviceType === "AIR_TICKET") {
        const value = cleanText(item.ticketType);

        if (!TICKET_TYPES.has(value)) {
          return NextResponse.json(
            {
              success: false,
              message: `Ticket type is required on item ${itemNumber}.`,
            },
            { status: 400 }
          );
        }

        ticketType = value as NonNullable<PreparedItem["ticketType"]>;

        // Airline is mandatory and must be active in Settings.
        airlineName = cleanText(item.airlineName);

        if (!airlineName) {
          return NextResponse.json(
            {
              success: false,
              message: `Airline is required on item ${itemNumber}.`,
            },
            { status: 400 }
          );
        }

        const activeAirline = await prisma.airline.findFirst({
          where: {
            name: airlineName,
            isActive: true,
          },
          select: {
            name: true,
          },
        });

        if (!activeAirline) {
          return NextResponse.json(
            {
              success: false,
              message: `Selected airline is unavailable on item ${itemNumber}.`,
            },
            { status: 400 }
          );
        }

        airlineName = activeAirline.name;

        // Baggage allowance is optional but must be a valid weight in kg.
        if (
          item.baggageWeightKg !== undefined &&
          item.baggageWeightKg !== null &&
          item.baggageWeightKg !== ""
        ) {
          const parsedBaggageWeight = toNumber(item.baggageWeightKg);

          if (
            !Number.isFinite(parsedBaggageWeight) ||
            parsedBaggageWeight < 0 ||
            parsedBaggageWeight > 9999.99
          ) {
            return NextResponse.json(
              {
                success: false,
                message: `Baggage weight must be a valid non-negative kg value on item ${itemNumber}.`,
              },
              { status: 400 }
            );
          }

          baggageWeightKg = formatMoney(parsedBaggageWeight);
        }

        // Calculate the ticket from passenger-specific prices when supplied.
        // The amount/quantity fallback is retained for older clients.
        const hasPassengerFields = [
          item.adultPrice,
          item.adultQuantity,
          item.childPrice,
          item.childQuantity,
          item.infantPrice,
          item.infantQuantity,
        ].some((value) => value !== undefined);

        if (hasPassengerFields) {
          const adult = getPassengerValue(item, "adultPrice", "adultQuantity");
          const child = getPassengerValue(item, "childPrice", "childQuantity");
          const infant = getPassengerValue(item, "infantPrice", "infantQuantity");

          const passengers = [
            { label: "Adult", ...adult },
            { label: "Child", ...child },
            { label: "Infant", ...infant },
          ];

          let hasPassenger = false;

          for (const passenger of passengers) {
            if (
              !Number.isSafeInteger(passenger.quantity) ||
              passenger.quantity < 0
            ) {
              return NextResponse.json(
                {
                  success: false,
                  message: `${passenger.label} quantity must be a non-negative whole number on item ${itemNumber}.`,
                },
                { status: 400 }
              );
            }

            if (!Number.isFinite(passenger.price) || passenger.price < 0) {
              return NextResponse.json(
                {
                  success: false,
                  message: `${passenger.label} price must be a valid non-negative amount on item ${itemNumber}.`,
                },
                { status: 400 }
              );
            }

            if (passenger.quantity > 0) {
              hasPassenger = true;

              const rawPrice =
                item[
                  passenger.label === "Adult"
                    ? "adultPrice"
                    : passenger.label === "Child"
                      ? "childPrice"
                      : "infantPrice"
                ];

              if (rawPrice === undefined || rawPrice === "") {
                return NextResponse.json(
                  {
                    success: false,
                    message: `Enter the ${passenger.label.toLowerCase()} price on item ${itemNumber}.`,
                  },
                  { status: 400 }
                );
              }
            }
          }

          if (!hasPassenger) {
            return NextResponse.json(
              {
                success: false,
                message: `Enter a quantity for at least one adult, child, or infant on item ${itemNumber}.`,
              },
              { status: 400 }
            );
          }

          const ticketSubtotal =
            adult.price * adult.quantity +
            child.price * child.quantity +
            infant.price * infant.quantity;

          amount = toMoney(ticketSubtotal);
          quantity = 1;

          adultPrice = formatMoney(adult.price);
          adultQuantity = adult.quantity;
          childPrice = formatMoney(child.price);
          childQuantity = child.quantity;
          infantPrice = formatMoney(infant.price);
          infantQuantity = infant.quantity;

          const breakdown: string[] = [];

          if (adult.quantity > 0) {
            breakdown.push(
              `Adult SAR ${formatMoney(adult.price)} × ${adult.quantity}`
            );
          }

          if (child.quantity > 0) {
            breakdown.push(
              `Child SAR ${formatMoney(child.price)} × ${child.quantity}`
            );
          }

          if (infant.quantity > 0) {
            breakdown.push(
              `Infant SAR ${formatMoney(infant.price)} × ${infant.quantity}`
            );
          }

          description = [
            "Air Ticket",
            airlineName,
            ticketType === "RETURN" ? "Return Ticket" : "One Way Ticket",
            baggageWeightKg !== undefined
              ? `Baggage ${Number(baggageWeightKg)} kg`
              : "",
            ...breakdown,
          ]
            .filter(Boolean)
            .join(" · ");
        } else {
          description = [
            "Air Ticket",
            airlineName,
            ticketType === "RETURN" ? "Return Ticket" : "One Way Ticket",
            baggageWeightKg !== undefined
              ? `Baggage ${Number(baggageWeightKg)} kg`
              : "",
          ]
            .filter(Boolean)
            .join(" · ");
        }
      }

      if (serviceType === "TRANSPORTATION") {
        routeId = Number(item.routeId);
        vehicleTypeId = Number(item.vehicleTypeId);

        if (!Number.isInteger(routeId) || routeId <= 0) {
          return NextResponse.json(
            {
              success: false,
              message: `Route is required on item ${itemNumber}.`,
            },
            { status: 400 }
          );
        }

        if (!Number.isInteger(vehicleTypeId) || vehicleTypeId <= 0) {
          return NextResponse.json(
            {
              success: false,
              message: `Vehicle type is required on item ${itemNumber}.`,
            },
            { status: 400 }
          );
        }

        const [route, vehicle] = await Promise.all([
          prisma.route.findFirst({
            where: { id: routeId, isActive: true },
          }),
          prisma.vehicleType.findFirst({
            where: { id: vehicleTypeId, isActive: true },
          }),
        ]);

        if (!route) {
          return NextResponse.json(
            {
              success: false,
              message: `Selected route is unavailable on item ${itemNumber}.`,
            },
            { status: 400 }
          );
        }

        if (!vehicle) {
          return NextResponse.json(
            {
              success: false,
              message: `Selected vehicle type is unavailable on item ${itemNumber}.`,
            },
            { status: 400 }
          );
        }

        description = `${route.name} - ${vehicle.name}`;
      }

      const additionalDescription = cleanText(item.additionalDescription);
      if (additionalDescription) {
        description = description
          ? `${description} · ${additionalDescription}`
          : additionalDescription;
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Amount must be greater than zero on item ${itemNumber}.`,
          },
          { status: 400 }
        );
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Quantity must be greater than zero on item ${itemNumber}.`,
          },
          { status: 400 }
        );
      }

      if (discount < 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Discount cannot be negative on item ${itemNumber}.`,
          },
          { status: 400 }
        );
      }

      lineSubtotal = amount * quantity;

      if (serviceType === "HOTEL_ACCOMMODATION") {
        lineSubtotal *= numberOfDays ?? 1;
      }

      const subtotalCentsForItem = Math.round(lineSubtotal * 100);
      const discountCentsForItem = Math.round(discount * 100);

      if (discountCentsForItem > subtotalCentsForItem) {
        return NextResponse.json(
          {
            success: false,
            message: `Discount cannot exceed the item subtotal on item ${itemNumber}.`,
          },
          { status: 400 }
        );
      }

      const totalCentsForItem = Math.max(
        0,
        subtotalCentsForItem - discountCentsForItem
      );

      subtotalCents += subtotalCentsForItem;
      totalDiscountCents += discountCentsForItem;
      grandTotalCents += totalCentsForItem;

      preparedItems.push({
        serviceType,
        description,
        ...(visaType ? { visaType } : {}),
        ...(hotelName ? { hotelName } : {}),
        ...(roomType ? { roomType } : {}),
        ...(numberOfDays !== undefined ? { numberOfDays } : {}),
        ...(paxCount !== undefined ? { paxCount } : {}),
        ...(acType ? { acType } : {}),
        ...(boardType ? { boardType } : {}),
        ...(ticketType ? { ticketType } : {}),
        ...(airlineName ? { airlineName } : {}),
        ...(baggageWeightKg !== undefined ? { baggageWeightKg } : {}),
        ...(adultPrice !== undefined ? { adultPrice } : {}),
        ...(adultQuantity !== undefined ? { adultQuantity } : {}),
        ...(childPrice !== undefined ? { childPrice } : {}),
        ...(childQuantity !== undefined ? { childQuantity } : {}),
        ...(infantPrice !== undefined ? { infantPrice } : {}),
        ...(infantQuantity !== undefined ? { infantQuantity } : {}),
        ...(routeId !== undefined ? { routeId } : {}),
        ...(vehicleTypeId !== undefined ? { vehicleTypeId } : {}),
        amount: formatMoney(amount),
        quantity: quantity.toFixed(2),
        discount: formatMoney(discount),
        totalAmount: formatMoney(totalCentsForItem / 100),
        sortOrder: index,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.create({
        data: {
          quotationNo: createTemporaryQuotationNo(),
          customerId,
          currency,
          quotationDate: new Date(),
          validUntil: validUntilDate,
          customerName: customer.name,
          customerMobile: customer.mobile,
          customerWhatsapp: customer.whatsapp,
          customerEmail: customer.email,
          customerAddress: customer.address,
          customerNationality: customer.nationality,
          customerPassportNo: customer.passportNo,
          subtotal: formatMoney(subtotalCents / 100),
          discount: formatMoney(totalDiscountCents / 100),
          totalAmount: formatMoney(grandTotalCents / 100),
          status: "GENERATED",
          createdById: userId,
          bankDetailsSnapshot: selectedBankSnapshots,
          termsConditionsSnapshot: selectedTermsSnapshots,
          items: {
            create: preparedItems.map((item) => ({
              serviceType: item.serviceType,
              description: item.description,
              visaType: item.visaType,
              hotelName: item.hotelName,
              roomType: item.roomType,
              numberOfDays: item.numberOfDays,
              paxCount: item.paxCount,
              acType: item.acType,
              boardType: item.boardType,
              ticketType: item.ticketType,
              airlineName: item.airlineName,
              baggageWeightKg: item.baggageWeightKg,
              adultPrice: item.adultPrice,
              adultQuantity: item.adultQuantity,
              childPrice: item.childPrice,
              childQuantity: item.childQuantity,
              infantPrice: item.infantPrice,
              infantQuantity: item.infantQuantity,
              routeId: item.routeId,
              vehicleTypeId: item.vehicleTypeId,
              amount: item.amount,
              quantity: item.quantity,
              discount: item.discount,
              totalAmount: item.totalAmount,
              sortOrder: item.sortOrder,
            })),
          },
        },
        include: {
          customer: true,
          items: {
            orderBy: { sortOrder: "asc" },
            include: { route: true, vehicleType: true },
          },
        },
      });

      const year = quotation.quotationDate.getFullYear();
      const quotationNo =
        `QT-${year}-${String(quotation.id).padStart(5, "0")}`;

      return tx.quotation.update({
        where: { id: quotation.id },
        data: { quotationNo },
        include: {
          customer: true,
          items: {
            orderBy: { sortOrder: "asc" },
            include: { route: true, vehicleType: true },
          },
        },
      });
    });

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
        message: "Quotation generated successfully.",
        quotation: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Quotation POST error:", error);

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