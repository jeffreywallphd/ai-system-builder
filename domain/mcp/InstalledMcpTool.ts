import type { McpToolDefinition } from "./McpToolCapability";

export type InstalledMcpToolStatus = "enabled" | "disabled";
export type McpToolDefinitionSourceKind = "inline" | "local" | "remote";

export interface McpToolDefinitionSource {
  readonly kind: McpToolDefinitionSourceKind;
  readonly location: string;
}

export interface InstalledMcpToolRecord {
  readonly toolId: string;
  readonly definition: McpToolDefinition;
  readonly status: InstalledMcpToolStatus;
  readonly installedAt: string;
  readonly updatedAt: string;
  readonly source: McpToolDefinitionSource;
}

export function createInstalledMcpToolRecord(params: {
  readonly definition: McpToolDefinition;
  readonly source: McpToolDefinitionSource;
  readonly now?: Date;
  readonly status?: InstalledMcpToolStatus;
}): InstalledMcpToolRecord {
  const nowIso = (params.now ?? new Date()).toISOString();
  return Object.freeze({
    toolId: params.definition.id,
    definition: params.definition,
    status: params.status ?? "enabled",
    installedAt: nowIso,
    updatedAt: nowIso,
    source: Object.freeze({
      kind: params.source.kind,
      location: params.source.location.trim(),
    }),
  });
}
