import { createApiError, createApiFailureResponse } from "../../../../contracts/api";
import { SecurityApplicationError } from "../../../../contracts/security";

export function createSecurityApiFailure(error: { code: string; message: string; status: number; details?: Record<string, unknown> }) {
  return createApiFailureResponse(createApiError(error.code as `${Lowercase<string>}.${Lowercase<string>}`, error.status === 403 ? "forbidden" : "unauthorized", error.message, { details: error.details }));
}

export function mapSecurityFailure(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof SecurityApplicationError) {
    return { status: error.code === "security.forbidden" ? 403 : 401, code: error.code, message: error.message };
  }
  return { status: 500, code: "security.internal", message: "Security middleware failed." };
}
