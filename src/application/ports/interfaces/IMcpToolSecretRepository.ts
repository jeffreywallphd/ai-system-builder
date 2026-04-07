import type { McpToolCredentialFieldRequirement } from "@domain/mcp/McpToolTrust";

export type McpToolSecretScopeType = "global" | "project" | "user";

export interface McpToolSecretScope {
  readonly scopeType: McpToolSecretScopeType;
  readonly scopeId?: string;
}

export interface McpToolSecretReferenceRecord {
  readonly toolId: string;
  readonly scopeType: McpToolSecretScopeType;
  readonly scopeId?: string;
  readonly fields: ReadonlyArray<McpToolCredentialFieldRequirement>;
  readonly updatedAt: string;
}

export interface ResolvedMcpToolSecretRecord {
  readonly toolId: string;
  readonly scopeType: McpToolSecretScopeType;
  readonly scopeId?: string;
  readonly values: Readonly<Record<string, string>>;
  readonly updatedAt: string;
}

export interface IMcpToolSecretRepository {
  getSecretReference(toolId: string, scope?: McpToolSecretScope): Promise<McpToolSecretReferenceRecord | undefined>;
  resolveSecret(toolId: string, scope?: McpToolSecretScope): Promise<ResolvedMcpToolSecretRecord | undefined>;
  upsertSecret(
    toolId: string,
    values: Readonly<Record<string, string>>,
    fields: ReadonlyArray<McpToolCredentialFieldRequirement>,
    scope?: McpToolSecretScope,
  ): Promise<McpToolSecretReferenceRecord>;
  removeSecret(toolId: string, scope?: McpToolSecretScope): Promise<boolean>;
}

