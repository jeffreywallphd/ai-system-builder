export type McpToolRegistryErrorCode =
  | "invalid-definition"
  | "duplicate-install"
  | "tool-not-found"
  | "tool-disabled"
  | "invalid-transition"
  | "unsafe-removal"
  | "invalid-input-contract"
  | "invalid-output-contract"
  | "missing-auth-configuration"
  | "invalid-auth-configuration"
  | "invalid-credentials"
  | "auth-resolution-failed"
  | "permission-denied";

export class McpToolRegistryError extends Error {
  constructor(
    readonly code: McpToolRegistryErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "McpToolRegistryError";
  }
}
