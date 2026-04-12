import type {
  IRuntimeSecurityMaterialResolverPort,
  ResolveUserProviderCredentialMaterialInput,
  ResolveWorkspaceProviderCredentialMaterialInput,
  ResolvedSecurityMaterialCredential,
} from "@application/security/ports/SecurityMaterialResolutionPorts";
import type { SecretRuntimeConsumptionAdapters } from "@application/security/services/SecretRuntimeConsumptionAdapters";
import type { SecretServiceResult } from "@application/security/use-cases/SecretManagementServiceContracts";

export const ServerPlatformProviderIds = Object.freeze({
  openAi: "openai",
  huggingFace: "huggingface",
});

export type ServerPlatformProviderId = typeof ServerPlatformProviderIds[keyof typeof ServerPlatformProviderIds];

export interface ResolveServerProviderCredentialInput {
  readonly providerId: ServerPlatformProviderId;
  readonly secretId: string;
  readonly operationKey: string;
  readonly serviceIdentity: string;
  readonly justification?: string;
  readonly occurredAt?: string;
}

export interface ResolveServerSigningMaterialInput {
  readonly secretId: string;
  readonly operationKey: string;
  readonly serviceIdentity: string;
  readonly signingPurpose: string;
  readonly versionId?: string;
  readonly allowSupersededVersion?: boolean;
  readonly justification?: string;
  readonly occurredAt?: string;
}

export interface ServerPlatformResolvedCredential {
  readonly secretId: string;
  readonly currentVersionId: string;
  readonly credential: string;
}

export class ServerPlatformSecretConsumers implements IRuntimeSecurityMaterialResolverPort {
  public constructor(
    private readonly runtimeSecretConsumptionAdapters: SecretRuntimeConsumptionAdapters,
  ) {}

  public async resolveServerProviderCredential(
    input: ResolveServerProviderCredentialInput,
  ): Promise<SecretServiceResult<ServerPlatformResolvedCredential>> {
    const result = await this.runtimeSecretConsumptionAdapters.resolveServerSigningCredential({
      secretId: input.secretId,
      operationKey: input.operationKey,
      serviceIdentity: input.serviceIdentity,
      signingPurpose: `provider-credential:${input.providerId}`,
      justification: normalizeOptional(input.justification)
        ?? `resolve server provider credential for '${input.providerId}'`,
      occurredAt: input.occurredAt,
    });

    return toResolvedCredentialResult(result);
  }

  public async resolveIdentitySessionSigningMaterial(
    input: ResolveServerSigningMaterialInput,
  ): Promise<SecretServiceResult<ServerPlatformResolvedCredential>> {
    return this.resolveServerSigningMaterial(input);
  }

  public async resolveServerSigningMaterial(
    input: ResolveServerSigningMaterialInput,
  ): Promise<SecretServiceResult<ServerPlatformResolvedCredential>> {
    const result = await this.runtimeSecretConsumptionAdapters.resolveServerSigningCredential({
      secretId: input.secretId,
      operationKey: input.operationKey,
      serviceIdentity: input.serviceIdentity,
      signingPurpose: input.signingPurpose,
      ...(normalizeOptional(input.versionId)
        ? Object.freeze({
          versionId: normalizeOptional(input.versionId),
        })
        : undefined),
      ...(input.allowSupersededVersion === true
        ? Object.freeze({
          allowSupersededVersion: true,
        })
        : undefined),
      justification: normalizeOptional(input.justification)
        ?? `resolve server signing material for '${input.signingPurpose}'`,
      occurredAt: input.occurredAt,
    });

    return toResolvedCredentialResult(result);
  }

  public async resolveWorkspaceProviderCredential(
    input: ResolveWorkspaceProviderCredentialMaterialInput,
  ): Promise<SecretServiceResult<ResolvedSecurityMaterialCredential>> {
    const result = await this.runtimeSecretConsumptionAdapters.resolveWorkspaceProviderCredential({
      workspaceId: input.workspaceId,
      providerId: input.providerId,
      secretId: input.secretId,
      operationKey: input.operationKey,
      serviceIdentity: input.serviceIdentity,
      justification: normalizeOptional(input.justification)
        ?? `resolve workspace provider credential for '${input.providerId}'`,
      occurredAt: input.occurredAt,
    });

    return toResolvedCredentialResult(result);
  }

  public async resolveUserProviderCredential(
    input: ResolveUserProviderCredentialMaterialInput,
  ): Promise<SecretServiceResult<ResolvedSecurityMaterialCredential>> {
    const result = await this.runtimeSecretConsumptionAdapters.resolveUserPersonalApiKey({
      userIdentityId: input.userIdentityId,
      workspaceId: input.workspaceId,
      providerId: input.providerId,
      secretId: input.secretId,
      operationKey: input.operationKey,
      serviceIdentity: input.serviceIdentity,
      justification: normalizeOptional(input.justification)
        ?? `resolve user provider credential for '${input.providerId}'`,
      occurredAt: input.occurredAt,
    });

    return toResolvedCredentialResult(result);
  }
}

function toResolvedCredentialResult(
  result: Awaited<ReturnType<SecretRuntimeConsumptionAdapters["resolveServerSigningCredential"]>>,
): SecretServiceResult<ServerPlatformResolvedCredential> {
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    value: Object.freeze({
      secretId: result.value.secretId,
      currentVersionId: result.value.currentVersionId,
      credential: result.value.credential,
    }),
  };
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
