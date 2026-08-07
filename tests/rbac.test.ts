import { describe, it, expect } from "vitest";
import { hasAtLeast, requireRole } from "@/lib/rbac";
import { ForbiddenError } from "@/lib/errors";

describe("role hierarchy", () => {
  it("orders READ_ONLY < SPECIALIST < MANAGER < ADMIN", () => {
    expect(hasAtLeast("ADMIN", "MANAGER")).toBe(true);
    expect(hasAtLeast("MANAGER", "ADMIN")).toBe(false);
    expect(hasAtLeast("SPECIALIST", "SPECIALIST")).toBe(true);
    expect(hasAtLeast("READ_ONLY", "SPECIALIST")).toBe(false);
    expect(hasAtLeast("ADMIN", "READ_ONLY")).toBe(true);
  });

  it("requireRole throws ForbiddenError below the threshold and passes at/above it", () => {
    expect(() => requireRole("READ_ONLY", "SPECIALIST")).toThrow(ForbiddenError);
    expect(() => requireRole("SPECIALIST", "MANAGER")).toThrow(ForbiddenError);
    expect(() => requireRole("MANAGER", "MANAGER")).not.toThrow();
    expect(() => requireRole("ADMIN", "SPECIALIST")).not.toThrow();
  });
});
