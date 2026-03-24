import type { McpToolPermissionScope } from "../../../domain/mcp/McpToolTrust";
import type { IMcpToolRegistryRepository } from "../../ports/interfaces/IMcpToolRegistryRepository";
import type { IMcpToolSecretRepository } from "../../ports/interfaces/IMcpToolSecretRepository";
import { McpToolAuthService } from "../security/McpToolAuthService";
import { McpToolRegistryError } from "./McpToolRegistryErrors";

export class ConfigureMcpToolCredentialsUseCase {
  constructor(
    private readonly registryRepository: IMcpToolRegistryRepository,
    private readonly secretRepository: IMcpToolSecretRepository,
  ) {}

  public async execute(request: { readonly toolId: string; readonly values: Readonly<Record<string, string>> }) {
    const tool = await this.registryRepository.getInstalledTool(request.toolId.trim());
    if (!tool) {
      throw new McpToolRegistryError("tool-not-found", `MCP tool '${request.toolId}' was not found.`);
    }

    const configured = await this.secretRepository.upsertSecret(tool.toolId, request.values, tool.definition.auth.credentialFields ?? []);
    return configured;
  }
}

export class GetMcpToolCredentialStatusUseCase {
  private readonly authService: McpToolAuthService;

  constructor(
    private readonly registryRepository: IMcpToolRegistryRepository,
    secretRepository: IMcpToolSecretRepository,
  ) {
    this.authService = new McpToolAuthService(secretRepository);
  }

  public async execute(toolId: string) {
    const tool = await this.registryRepository.getInstalledTool(toolId.trim());
    if (!tool) {
      throw new McpToolRegistryError("tool-not-found", `MCP tool '${toolId}' was not found.`);
    }
    return this.authService.getCredentialStatus(tool);
  }
}

export class SetMcpToolPermissionsUseCase {
  constructor(private readonly registryRepository: IMcpToolRegistryRepository) {}

  public async execute(request: { readonly toolId: string; readonly grantedPermissions: ReadonlyArray<McpToolPermissionScope> }) {
    const tool = await this.registryRepository.getInstalledTool(request.toolId.trim());
    if (!tool) {
      throw new McpToolRegistryError("tool-not-found", `MCP tool '${request.toolId}' was not found.`);
    }
    const normalized = Object.freeze([...new Set(request.grantedPermissions.map((permission) => permission.trim()).filter(Boolean))] as McpToolPermissionScope[]);
    return this.registryRepository.saveInstalledTool(
      Object.freeze({
        ...tool,
        grantedPermissions: normalized,
        updatedAt: new Date().toISOString(),
      }),
    );
  }
}
