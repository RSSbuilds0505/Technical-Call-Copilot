import { Role } from "@prisma/client";
import { ForbiddenError } from "./errors";

const roleRank: Record<Role, number> = {
  READ_ONLY: 0,
  SPECIALIST: 1,
  MANAGER: 2,
  ADMIN: 3,
};

export function hasAtLeast(role: Role, required: Role): boolean {
  return roleRank[role] >= roleRank[required];
}

/** Throws ForbiddenError unless the member's role meets the requirement. Server-side enforcement. */
export function requireRole(role: Role, required: Role): void {
  if (!hasAtLeast(role, required)) {
    throw new ForbiddenError(`This action requires the ${required.toLowerCase().replace("_", "-")} role or higher.`);
  }
}
