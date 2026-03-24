export type McpToolRegistryErrorCode =
  | "invalid-definition"
  | "duplicate-install"
  | "tool-not-found"
  | "invalid-transition"
  | "unsafe-removal"
  | "invalid-input-contract"
  | "invalid-output-contract";

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
