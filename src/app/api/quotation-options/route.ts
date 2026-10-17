import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

const SERVICE_TYPES = new Set([
  "UMRAH_VISA",
  "HOTEL_ACCOMMODATION",
  "AIR_TICKET",
  "TRANSPORTATION",
]);

class ValidationError extends Error {}

type BankInput = {
  slot: number;
  bankName?: unknown;
  accountName?: unknown;
  accountNumber?: unknown;
  iban?: unknown;
  swiftCode?: unknown;
  branchName?: unknown;
};

type TermsInput = {
  id?: unknown;
  serviceType?: unknown;
  title?: unknown;
  content?: unknown;
  isActive?: unknown;
};

function cleanText(value: unknown, maxLength = 10000): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function optionalText(value: unknown, maxLength: number): string | null {
  return cleanText(value, maxLength) || null;
}

function emptyBank(slot: number) {
  return {
    id: null,
    slot,
    bankName: "",
    accountName: "",
    accountNumber: "",
    iban: "",
    swiftCode: "",
    branchName: "",
  };
}

export async function GET() {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const [savedBanks, termsConditions] = await Promise.all([
      prisma.quotationBankDetail.findMany({
        orderBy: { slot: "asc" },
      }),
      prisma.quotationServiceTermsCondition.findMany({
        orderBy: [{ serviceType: "asc" }, { title: "asc" }],
      }),
    ]);

    const banks = [1, 2, 3].map(
      (slot) => savedBanks.find((bank) => bank.slot === slot) ?? emptyBank(slot)
    );

    return NextResponse.json({
      success: true,
      banks,
      termsConditions,
    });
  } catch (error) {
    console.error("Quotation options GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load bank details and terms & conditions.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    let body: {
      banks?: unknown;
      termsConditions?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.banks) || body.banks.length !== 3) {
      return NextResponse.json(
        {
          success: false,
          message: "Exactly three bank detail slots are required.",
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.termsConditions)) {
      return NextResponse.json(
        {
          success: false,
          message: "Terms & conditions must be provided as a list.",
        },
        { status: 400 }
      );
    }

    if (body.termsConditions.length > 100) {
      return NextResponse.json(
        {
          success: false,
          message: "You can save up to 100 terms & conditions templates.",
        },
        { status: 400 }
      );
    }

    const banks = body.banks as BankInput[];
    const slots = banks.map((bank) => Number(bank?.slot));

    if (
      slots.some(
        (slot) => !Number.isInteger(slot) || slot < 1 || slot > 3
      ) ||
      new Set(slots).size !== 3
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Bank detail slots must be 1, 2 and 3.",
        },
        { status: 400 }
      );
    }

    const preparedBanks = banks.map((bank) => ({
      slot: Number(bank.slot),
      bankName: cleanText(bank.bankName, 150),
      accountName: cleanText(bank.accountName, 150),
      accountNumber: cleanText(bank.accountNumber, 100),
      iban: optionalText(bank.iban, 100),
      swiftCode: optionalText(bank.swiftCode, 50),
      branchName: optionalText(bank.branchName, 150),
    }));

    const preparedTerms = (
      body.termsConditions as TermsInput[]
    ).map((row, index) => {
      const id =
        row?.id === null ||
        row?.id === undefined ||
        row.id === ""
          ? null
          : Number(row.id);

      const serviceType = cleanText(row?.serviceType, 50);
      const title = cleanText(row?.title, 150);
      const content = cleanText(row?.content, 10000);

      if (id !== null && (!Number.isInteger(id) || id <= 0)) {
        throw new ValidationError(
          `Terms & conditions row ${index + 1} has an invalid ID.`
        );
      }

      if (!SERVICE_TYPES.has(serviceType)) {
        throw new ValidationError(
          `Choose a valid service type for terms & conditions row ${index + 1}.`
        );
      }

      if (!title || !content) {
        throw new ValidationError(
          `Enter both a title and the terms & conditions text for row ${index + 1}.`
        );
      }

      return {
        id,
        serviceType,
        title,
        content,
        isActive: row?.isActive !== false,
      };
    });

    const saved = await prisma.$transaction(async (tx) => {
      for (const bank of preparedBanks) {
        const { slot, ...data } = bank;

        await tx.quotationBankDetail.upsert({
          where: { slot },
          update: data,
          create: { slot, ...data },
        });
      }

      const keptIds: number[] = [];

      for (const row of preparedTerms) {
        const { id, ...data } = row;

        if (id !== null) {
          const existing =
            await tx.quotationServiceTermsCondition.findUnique({
              where: { id },
              select: { id: true },
            });

          if (existing) {
            await tx.quotationServiceTermsCondition.update({
              where: { id },
              data,
            });

            keptIds.push(id);
          } else {
            const created =
              await tx.quotationServiceTermsCondition.create({
                data,
              });

            keptIds.push(created.id);
          }
        } else {
          const created =
            await tx.quotationServiceTermsCondition.create({
              data,
            });

          keptIds.push(created.id);
        }
      }

      if (keptIds.length > 0) {
        await tx.quotationServiceTermsCondition.deleteMany({
          where: { id: { notIn: keptIds } },
        });
      } else {
        await tx.quotationServiceTermsCondition.deleteMany();
      }

      const [savedBanks, savedTerms] = await Promise.all([
        tx.quotationBankDetail.findMany({
          orderBy: { slot: "asc" },
        }),
        tx.quotationServiceTermsCondition.findMany({
          orderBy: [{ serviceType: "asc" }, { title: "asc" }],
        }),
      ]);

      return { savedBanks, savedTerms };
    });

    await writeAuditLog({
      userId,
      module: "SETTINGS",
      action: "UPDATE_QUOTATION_OPTIONS",
      entity: "QuotationOptions",
      description:
        "Updated quotation bank details and service-specific terms & conditions.",
      metadata: {
        configuredBankCount: preparedBanks.filter(
          (bank) =>
            bank.bankName && bank.accountName && bank.accountNumber
        ).length,
        termsTemplateCount: saved.savedTerms.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Quotation options saved successfully.",
      banks: [1, 2, 3].map(
        (slot) =>
          saved.savedBanks.find((bank) => bank.slot === slot) ??
          emptyBank(slot)
      ),
      termsConditions: saved.savedTerms,
    });
  } catch (error) {
    console.error("Quotation options PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to save quotation options.",
      },
      { status: error instanceof ValidationError ? 400 : 500 }
    );
  }
}