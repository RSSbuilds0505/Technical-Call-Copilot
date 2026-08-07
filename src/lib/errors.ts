import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(message: string, public status: number = 400, public code: string = "bad_request") {
    super(message);
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = "Sign in to continue.") { super(message, 401, "unauthorized"); }
}
export class ForbiddenError extends AppError {
  constructor(message = "You don't have permission to do that.") { super(message, 403, "forbidden"); }
}
export class NotFoundError extends AppError {
  constructor(message = "Not found.") { super(message, 404, "not_found"); }
}

/** Wraps an API route handler with centralized error handling. */
export function apiHandler<T extends unknown[]>(
  fn: (...args: T) => Promise<Response>
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await fn(...args);
    } catch (err) {
      // Next.js uses thrown errors as control flow when deciding a route is dynamic
      // (e.g. cookies() during build-time static analysis). Those must propagate.
      if (err instanceof Error && "digest" in err && String((err as { digest?: unknown }).digest).startsWith("DYNAMIC_SERVER_USAGE")) {
        throw err;
      }
      if (err instanceof AppError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
      }
      if (err instanceof ZodError) {
        const detail = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        return NextResponse.json({ error: `Invalid input: ${detail}`, code: "validation" }, { status: 422 });
      }
      console.error("Unhandled API error:", err);
      return NextResponse.json({ error: "Something went wrong. Try again.", code: "internal" }, { status: 500 });
    }
  };
}
