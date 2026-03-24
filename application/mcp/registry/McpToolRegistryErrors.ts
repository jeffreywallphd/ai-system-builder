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
  | "permission-denied"
  | "approval-required"
  | "sandbox-denied";

export class McpToolRegistryError extends Error {
  readonly category: "sandbox" | "permission" | "approval" | "auth" | "contract" | "runtime" | "registry";

  constructor(
    readonly code: McpToolRegistryErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "McpToolRegistryError";
    this.category = classifyMcpToolErrorCategory(code);
  }
}

function classifyMcpToolErrorCategory(code: McpToolRegistryErrorCode): McpToolRegistryError["category"] {
  if (code === "sandbox-denied") {
    return "sandbox";
  }
  if (code === "permission-denied") {
    return "permission";
  }
  if (code === "approval-required") {
    return "approval";
  }
  if (code === "missing-auth-configuration" || code === "invalid-auth-configuration" || code === "invalid-credentials" || code === "auth-resolution-failed") {
    return "auth";
  }
  if (code === "invalid-definition" || code === "invalid-input-contract" || code === "invalid-output-contract" || code === "invalid-transition") {
    return "contract";
  }
  if (code === "tool-not-found" || code === "duplicate-install" || code === "tool-disabled" || code === "unsafe-removal") {
    return "registry";
  }
  return "runtime";
}
