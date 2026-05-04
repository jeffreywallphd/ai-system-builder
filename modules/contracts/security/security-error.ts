export const SECURITY_ERROR_CODES = [
  "security.disabled",
  "security.https-required",
  "security.unauthenticated",
  "security.invalid-token",
  "security.expired-token",
  "security.revoked-token",
  "security.forbidden",
  "security.pairing-disabled",
  "security.pairing-code-invalid",
  "security.pairing-code-expired",
  "security.rate-limited",
  "security.internal",
] as const;

export type SecurityErrorCode = (typeof SECURITY_ERROR_CODES)[number];

export interface SecurityError {
  code: SecurityErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export function createSecurityError(code: SecurityErrorCode, message: string, details?: Record<string, unknown>): SecurityError {
  return { code, message, details };
}
