import { createHash } from "node:crypto";
import {
  SecretAccessActions,
  SecretActorTypes,
  SecretScopes,
} from "@domain/security/SecretDomain";
import {
  SecretProviderMaterialKinds,
  type ISecretProviderMaterialResolutionPort,
  type SecretProviderMaterialKind,
} from "@application/security/ports/SecretProviderPorts";
import { ScopedSecretProviderMaterialRetrievalUseCase } from "@application/security/use-cases/ScopedSecretProviderMaterialRetrievalUseCase";
import { SecretServiceErrorCodes } from "@application/security/use-cases/SecretManagementServiceContracts";
import { DefaultSecretProviderResolutionService } from "@infrastructure/security/DefaultSecretProviderResolutionService";
import type { ServerComposedSecretService } from "@infrastructure/security/secrets/SecretServiceComposition";
import {
  SecurityMaterialSourceKinds,
  type SecurityMaterialStartupValidationResult,
} from "@application/security/services/SecurityMaterialStartupValidationPipeline";

interface SecurityMaterialDiagnosticsLogger {
  warn(event: Readonly<Record<string, unknown>>): void;
}

export interface ResolveCriticalServerSecurityMaterialInput {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly secretService: ServerComposedSecretService;
  readonly materialId: string;
  readonly environmentKey: string;
  readonly inheritedEnvironmentKey?: string;
  readonly startupSecurityMaterialValidation?: SecurityMaterialStartupValidationResult;
  readonly logger?: SecurityMaterialDiagnosticsLogger;
  readonly materialFormat: "string-secret" | "aes256-base64";
  readonly secretProviderResolutionPort?: ISecretProviderMaterialResolutionPort;
}

interface CriticalServerSecurityMaterialBinding {
  readonly providerId: string;
  readonly secretId: string;
  readonly materialKind: SecretProviderMaterialKind;
  readonly usage: string;
}

const CriticalServerSecurityMaterialBindings = new Map<string, CriticalServerSecurityMaterialBinding>([
  [
    "material:server:asset-download-grant-secret",
    Object.freeze({
      providerId: "platform",
      secretId: "secret:server:asset-download-grant",
      materialKind: SecretProviderMaterialKinds.generic,
      usage: "asset-download-grant",
    }),
  ],
  [
    "material:server:asset-content-encryption-key",
    Object.freeze({
      providerId: "platform",
      secretId: "secret:server:asset-content-encryption-key",
      materialKind: SecretProviderMaterialKinds.encryptionMaterial,
      usage: "asset-content-encryption",
    }),
  ],
  [
    "material:server:image-asset-storage-token-secret",
    Object.freeze({
      providerId: "platform",
      secretId: "secret:server:image-asset-storage-token",
      materialKind: SecretProviderMaterialKinds.generic,
      usage: "image-asset-storage-token",
    }),
  ],
  [
    "material:server:image-upload-session-token-secret",
    Object.freeze({
      providerId: "platform",
      secretId: "secret:server:image-upload-session-token",
      materialKind: SecretProviderMaterialKinds.generic,
      usage: "image-upload-session-token",
    }),
  ],
  [
    "material:server:generated-result-preview-access-token-secret",
    Object.freeze({
      providerId: "platform",
      secretId: "secret:server:generated-result-preview-access-token",
      materialKind: SecretProviderMaterialKinds.generic,
      usage: "generated-result-preview-access-token",
    }),
  ],
]);

export async function resolveCriticalServerSecurityMaterial(
  input: ResolveCriticalServerSecurityMaterialInput,
): Promise<string> {
  const binding = resolveSecurityMaterialBinding(input);
  const providerResolutionPort = input.secretProviderResolutionPort
    ?? createDefaultSecretProviderResolutionPort(input.secretService);
  const retrievalUseCase = new ScopedSecretProviderMaterialRetrievalUseCase({
    secretProviderResolutionPort: providerResolutionPort,
    secretAccessPolicyPort: input.secretService.secretAccessPolicyPort,
  });
  const now = new Date().toISOString();

  const providerResult = await retrievalUseCase.retrieveServerScopedSecretProviderMaterial({
    caller: Object.freeze({
      actorId: "runtime:server:critical-security-material-resolver",
      actorType: SecretActorTypes.serverRuntime,
      grantedActions: Object.freeze([SecretAccessActions.retrievePlaintext]),
    }),
    providerId: binding.providerId,
    secretId: binding.secretId,
    materialKind: binding.materialKind,
    access: {
      operationKey: `op:runtime:critical-security-material:resolve:${binding.secretId}:${Date.now()}`,
      serviceIdentity: "runtime:server:critical-security-material-resolver",
      usage: binding.usage,
      justification: `resolve critical server security material '${input.materialId}'`,
      occurredAt: now,
    },
  });
  if (providerResult.ok) {
    return providerResult.value.rawValue;
  }

  const configured = resolveLegacyConfiguredMaterial(input);
  if (configured) {
    return configured;
  }

  const validation = input.startupSecurityMaterialValidation;
  if (!validation) {
    throw new Error(buildMissingMaterialErrorMessage(input, "Startup security material validation context is unavailable."));
  }

  const observation = validation.observations.find((entry) => entry.materialId === input.materialId);
  const isGovernedDevelopmentFallback = !validation.productionCapable
    && observation?.sourceKind === SecurityMaterialSourceKinds.generatedEphemeral;
  if (!isGovernedDevelopmentFallback) {
    throw new Error(buildMissingMaterialErrorMessage(
      input,
      providerResult.error.code !== SecretServiceErrorCodes.notFound
        ? `Provider retrieval failed (${providerResult.error.code}) and material is not eligible for governed development fallback in the current lifecycle policy.`
        : "Material is not eligible for governed development fallback in the current lifecycle policy.",
    ));
  }

  input.logger?.warn(Object.freeze({
    event: "authoritative-server.startup.security-material-governed-dev-fallback",
    details: Object.freeze({
      materialId: input.materialId,
      lifecycleStage: validation.lifecycleStage,
      environmentKey: input.environmentKey,
      inheritedEnvironmentKey: input.inheritedEnvironmentKey ?? "",
      productionCapable: validation.productionCapable ? "true" : "false",
    }),
  }));
  return deriveDeterministicDevelopmentFallback(input);
}

function deriveDeterministicDevelopmentFallback(
  input: ResolveCriticalServerSecurityMaterialInput,
): string {
  const namespace = normalizeOptional(input.environment.AI_LOOM_SECURITY_DEVELOPMENT_FALLBACK_NAMESPACE)
    ?? "ai-loom:security-material:development-fallback:v1";
  const hash = createHash("sha256")
    .update([
      namespace,
      input.materialId,
      input.environmentKey,
      input.inheritedEnvironmentKey ?? "",
    ].join(":"))
    .digest();

  if (input.materialFormat === "aes256-base64") {
    return hash.toString("base64");
  }

  return `development-only:${input.materialId}:${hash.toString("base64url").slice(0, 24)}`;
}

function createDefaultSecretProviderResolutionPort(
  secretService: ServerComposedSecretService,
): ISecretProviderMaterialResolutionPort {
  return new DefaultSecretProviderResolutionService({
    runtimeSecretConsumptionAdapters: secretService.runtimeSecretConsumptionAdapters,
    getSecretMetadata: (request) => secretService.getSecretMetadataUseCase.execute(request),
    createSecret: (request) => secretService.createSecretUseCase.execute(request),
    initializeServerSecretStore: async () => {
      const repositoryCheck = await secretService.listSecretsUseCase.execute({
        actor: Object.freeze({
          actorId: "runtime:server:critical-security-material-resolver:init",
          actorType: SecretActorTypes.serverAdmin,
          grantedActions: Object.freeze([SecretAccessActions.list]),
        }),
        owner: Object.freeze({
          scope: SecretScopes.server,
        }),
        limit: 1,
        offset: 0,
        includeDisabled: true,
        includeArchived: true,
        includeSoftDeleted: true,
      });
      if (!repositoryCheck.ok) {
        throw new Error(`server-secret-repository-init-failed:${repositoryCheck.error.code}`);
      }
    },
  });
}

function resolveLegacyConfiguredMaterial(input: ResolveCriticalServerSecurityMaterialInput): string | undefined {
  const configured = normalizeOptional(input.environment[input.environmentKey]);
  if (configured) {
    return configured;
  }

  if (input.inheritedEnvironmentKey) {
    const inherited = normalizeOptional(input.environment[input.inheritedEnvironmentKey]);
    if (inherited) {
      return inherited;
    }
  }

  return undefined;
}

function resolveSecurityMaterialBinding(
  input: ResolveCriticalServerSecurityMaterialInput,
): CriticalServerSecurityMaterialBinding {
  const known = CriticalServerSecurityMaterialBindings.get(input.materialId);
  if (known) {
    return known;
  }

  return Object.freeze({
    providerId: "platform",
    secretId: `secret:server:${input.materialId.replaceAll(":", "-")}`,
    materialKind: input.materialFormat === "aes256-base64"
      ? SecretProviderMaterialKinds.encryptionMaterial
      : SecretProviderMaterialKinds.generic,
    usage: input.materialId,
  });
}

function buildMissingMaterialErrorMessage(
  input: ResolveCriticalServerSecurityMaterialInput,
  reason: string,
): string {
  const inheritedLabel = input.inheritedEnvironmentKey
    ? ` or inherited key '${input.inheritedEnvironmentKey}'`
    : "";
  return [
    `Critical security material '${input.materialId}' is not configured.`,
    `Set '${input.environmentKey}'${inheritedLabel} to a durable provider-backed value.`,
    reason,
  ].join(" ");
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
