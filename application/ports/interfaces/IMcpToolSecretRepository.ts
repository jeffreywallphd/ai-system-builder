import type { McpToolCredentialFieldRequirement } from "../../../domain/mcp/McpToolTrust";

export interface McpToolSecretReferenceRecord {
  readonly toolId: string;
  readonly fields: ReadonlyArray<McpToolCredentialFieldRequirement>;
  readonly updatedAt: string;
}

export interface ResolvedMcpToolSecretRecord {
  readonly toolId: string;
  readonly values: Readonly<Record<string, string>>;
  readonly updatedAt: string;
}

export interface IMcpToolSecretRepository {
  getSecretReference(toolId: string): Promise<McpToolSecretReferenceRecord | undefined>;
  resolveSecret(toolId: string): Promise<ResolvedMcpToolSecretRecord | undefined>;
  upsertSecret(toolId: string, values: Readonly<Record<string, string>>, fields: ReadonlyArray<McpToolCredentialFieldRequirement>): Promise<McpToolSecretReferenceRecord>;
  removeSecret(toolId: string): Promise<boolean>;
}
