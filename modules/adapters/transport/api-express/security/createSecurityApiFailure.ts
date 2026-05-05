import { createApiError, createApiFailureResponse } from "../../../../contracts/api";
import { SecurityApplicationError } from "../../../../contracts/security";

export function createSecurityApiFailure(error: { code: string; message: string; status: number; details?: Record<string, unknown> }) {
  return createApiFailureResponse(createApiError(error.code as `${Lowercase<string>}.${Lowercase<string>}`, error.status === 403 ? "forbidden" : "unauthorized", error.message, { details: error.details }));
}

export function mapSecurityFailure(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof SecurityApplicationError) {
    if (error.code === "security.forbidden") return { status: 403, code: error.code, message: error.message };
    if (error.code === "security.pairing-code-invalid" || error.code === "security.pairing-code-expired" || error.code === "security.pairing-disabled") {
      return { status: 400, code: error.code, message: error.message };
    }
    return { status: 401, code: error.code, message: error.message };
  }
  return { status: 500, code: "security.internal", message: "Security middleware failed." };
}
