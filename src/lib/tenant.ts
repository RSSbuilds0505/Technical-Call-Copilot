import { Role } from "@prisma/client";
import { db } from "./db";
import { readSession } from "./auth";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "./errors";
import { requireRole } from "./rbac";

export interface TenantContext {
  userId: string;
  userName: string;
  userEmail: string;
  organizationId: string;
  organizationName: string;
  role: Role;
}

/**
 * Resolves the authenticated user + active organization membership.
 * Every service call goes through this; organizationId is then applied to every query.
 * This is the server-side tenant-isolation boundary — never trust org ids from the client.
 */
export async function requireTenant(minimumRole: Role = Role.READ_ONLY): Promise<TenantContext> {
  const session = await readSession();
  if (!session) throw new UnauthorizedError();
  if (!session.organizationId) throw new ForbiddenError("Create or join an organization first.");

  const membership = await db.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: session.organizationId, userId: session.userId } },
    include: { user: true, organization: true },
  });
  if (!membership || membership.organization.deletedAt) {
    throw new ForbiddenError("Your access to this organization has been removed.");
  }
  requireRole(membership.role, minimumRole);
  return {
    userId: membership.userId,
    userName: membership.user.name,
    userEmail: membership.user.email,
    organizationId: membership.organizationId,
    organizationName: membership.organization.name,
    role: membership.role,
  };
}

/** Loads a record by id scoped to the tenant; throws NotFound if it belongs to another org. */
export async function scopedFind<T extends { organizationId: string }>(
  record: T | null,
  ctx: TenantContext
): Promise<T> {
  if (!record || record.organizationId !== ctx.organizationId) throw new NotFoundError();
  return record;
}
