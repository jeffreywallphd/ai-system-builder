import type { IMcpToolSecretRepository } from "../../ports/interfaces/IMcpToolSecretRepository";
import type { InstalledMcpToolRecord } from "../../../domain/mcp/InstalledMcpTool";
import type { McpToolCredentialStatus } from "../../../domain/mcp/McpToolTrust";

export interface ResolvedMcpToolCredentialBundle {
  readonly toolId: string;
  readonly values: Readonly<Record<string, string>>;
}

export class McpToolAuthService {
  constructor(private readonly secretRepository: IMcpToolSecretRepository) {}

  public async getCredentialStatus(tool: InstalledMcpToolRecord): Promise<McpToolCredentialStatus> {
    const requiredFields = tool.definition.auth.credentialFields ?? [];
    const requiresAuth = tool.definition.auth.kind === "required";
    const resolved = await this.secretRepository.resolveSecret(tool.toolId);
    const missingRequiredFields = requiresAuth
      ? requiredFields
          .filter((field) => field.required)
          .map((field) => field.key)
          .filter((key) => !resolved?.values[key]?.trim())
      : [];

    return Object.freeze({
      toolId: tool.toolId,
      required: requiresAuth,
      configured: !!resolved,
      missingRequiredFields: Object.freeze(missingRequiredFields),
      updatedAt: resolved?.updatedAt,
    });
  }

  public async resolveRequiredCredentials(tool: InstalledMcpToolRecord): Promise<ResolvedMcpToolCredentialBundle | undefined> {
    if (tool.definition.auth.kind !== "required" && tool.definition.auth.kind !== "optional") {
      return undefined;
    }
    const resolved = await this.secretRepository.resolveSecret(tool.toolId);
    if (!resolved) {
      return undefined;
    }

    const requiredFields = tool.definition.auth.credentialFields ?? [];
    const missingRequired = requiredFields
      .filter((field) => field.required)
      .some((field) => !resolved.values[field.key]?.trim());

    if (tool.definition.auth.kind === "required" && missingRequired) {
      return undefined;
    }

    return Object.freeze({
      toolId: tool.toolId,
      values: Object.freeze({ ...resolved.values }),
    });
  }
}
