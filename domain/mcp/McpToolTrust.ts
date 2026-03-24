import type { McpToolDefinition, McpToolSideEffectClass } from "./McpToolCapability";

export type McpToolPermissionScope =
  | "asset.read"
  | "asset.write"
  | "network.access"
  | "filesystem.read"
  | "filesystem.write"
  | "system.exec";

export interface McpToolCredentialFieldRequirement {
  readonly key: string;
  readonly label: string;
  readonly secret: boolean;
  readonly required: boolean;
  readonly format?: "string" | "token" | "password";
  readonly description?: string;
}

export interface McpToolCredentialStatus {
  readonly toolId: string;
  readonly required: boolean;
  readonly configured: boolean;
  readonly missingRequiredFields: ReadonlyArray<string>;
  readonly updatedAt?: string;
}

export interface McpToolExecutionPermissionDecision {
  readonly allowed: boolean;
  readonly requiredPermissions: ReadonlyArray<McpToolPermissionScope>;
  readonly grantedPermissions: ReadonlyArray<McpToolPermissionScope>;
  readonly deniedPermissions: ReadonlyArray<McpToolPermissionScope>;
  readonly reason: "allowed" | "missing-grants";
}

const sideEffectPermissionMap: Readonly<Record<McpToolSideEffectClass, ReadonlyArray<McpToolPermissionScope>>> = Object.freeze({
  none: Object.freeze([]),
  read: Object.freeze(["asset.read"]),
  write: Object.freeze(["asset.write"]),
  network: Object.freeze(["network.access"]),
  system: Object.freeze(["filesystem.read", "filesystem.write", "system.exec"]),
});

export function deriveRequiredMcpToolPermissions(definition: McpToolDefinition): ReadonlyArray<McpToolPermissionScope> {
  const sideEffectPermissions = sideEffectPermissionMap[definition.sideEffects] ?? [];
  const explicitPermissions = (definition.permissions ?? []).filter(Boolean);
  return Object.freeze([...new Set([...sideEffectPermissions, ...explicitPermissions])]);
}
