import { db } from "./db";

export async function audit(params: {
  organizationId: string;
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId ?? null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId ?? null,
        metadata: (params.metadata ?? {}) as object,
      },
    });
  } catch (err) {
    // Audit failures must never break the primary operation.
    console.error("Audit log write failed:", err);
  }
}
