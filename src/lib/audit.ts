
import "server-only";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export type AuditLogInput = {
  userId?: number | null;
  module: string;
  action: string;
  entity?: string;
  entityId?: string;
  description: string;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAuditLog(
  input: AuditLogInput
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        module: input.module,
        action: input.action,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        description: input.description,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    /*
     * Audit failure should never break the main business operation.
     * Keep the error in the server console for investigation.
     */
    console.error("Audit log write failed:", error);
  }
}