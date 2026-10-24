import { prisma } from "@/lib/prisma";
import { QuotationStatus } from "@/generated/prisma/client";

/**
 * Returns today's date in the Colombo timezone as YYYY-MM-DD.
 */
export function getCurrentQuotationDate(
  now: Date = new Date()
): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find(
    (part) => part.type === "year"
  )?.value;

  const month = parts.find(
    (part) => part.type === "month"
  )?.value;

  const day = parts.find(
    (part) => part.type === "day"
  )?.value;

  if (!year || !month || !day) {
    throw new Error(
      "Unable to determine the current quotation date."
    );
  }

  return `${year}-${month}-${day}`;
}

/**
 * Changes overdue generated quotations to EXPIRED.
 *
 * A quotation is valid through its selected Valid Until date.
 * It expires once that date has passed.
 *
 * Accepted, rejected, cancelled and already expired
 * quotations are not changed.
 */
export async function expireOverdueQuotations(): Promise<number> {
  const todayStartUtc = new Date(
    `${getCurrentQuotationDate()}T00:00:00.000Z`
  );

  const result = await prisma.quotation.updateMany({
    where: {
      status: QuotationStatus.GENERATED,
      validUntil: {
        lt: todayStartUtc,
      },
    },
    data: {
      status: QuotationStatus.EXPIRED,
    },
  });

  return result.count;
}