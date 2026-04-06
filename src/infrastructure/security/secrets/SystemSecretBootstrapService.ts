import {
  SecretAccessActions,
  SecretActorTypes,
  SecretKinds,
  SecretScopes,
  type SecretKind,
} from "../../../domain/security/SecretDomain";
import type { ServerComposedSecretService } from "./SecretServiceComposition";
import {
  ServerPlatformProviderIds,
  ServerPlatformSecretConsumers,
} from "./ServerPlatformSecretConsumers";

const SYSTEM_SECRET_BOOTSTRAP_ENV_KEYS = Object.freeze({
  requiredSecretIds: "AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS",
  migrateLegacyEnvironmentValues: "AI_LOOM_SECRET_BOOTSTRAP_MIGRATE_LEGACY_ENV",
  openAiApiKey: "OPENAI_API_KEY",
  huggingFaceApiToken: "HUGGINGFACE_API_TOKEN",
  identitySessionSigningPrivateKey: "AI_LOOM_IDENTITY_SESSION_SIGNING_PRIVATE_KEY",
});

interface SystemSecretDefinition {
  readonly secretId: string;
  readonly name: string;
  readonly kind: SecretKind;
  readonly metadata: {
    readonly tags: ReadonlyArray<string>;
    readonly labels: Readonly<Record<string, string>>;
  };
  readonly runtimePurpose: string;
  readonly runtimeConsumer: "provider-credential" | "server-signing";
  readonly providerId?: "openai" | "huggingface";
  readonly legacyEnvironmentVariable?: string;
}

const SystemSecretDefinitions: ReadonlyArray<SystemSecretDefinition> = Object.freeze([
  Object.freeze({
    secretId: "secret:server:provider:openai",
    name: "provider.openai.api-key",
    kind: SecretKinds.apiKey,
    metadata: Object.freeze({
      tags: Object.freeze(["server", "provider", "openai"]),
      labels: Object.freeze({
        provider: "openai",
        usage: "model-inference",
      }),
    }),
    runtimePurpose: "server-provider-openai-runtime",
    runtimeConsumer: "provider-credential",
    providerId: ServerPlatformProviderIds.openAi,
    legacyEnvironmentVariable: SYSTEM_SECRET_BOOTSTRAP_ENV_KEYS.openAiApiKey,
  }),
  Object.freeze({
    secretId: "secret:server:provider:huggingface",
    name: "provider.huggingface.api-token",
    kind: SecretKinds.accessToken,
    metadata: Object.freeze({
      tags: Object.freeze(["server", "provider", "huggingface"]),
      labels: Object.freeze({
        provider: "huggingface",
        usage: "model-repository",
      }),
    }),
    runtimePurpose: "server-provider-huggingface-runtime",
    runtimeConsumer: "provider-credential",
    providerId: ServerPlatformProviderIds.huggingFace,
    legacyEnvironmentVariable: SYSTEM_SECRET_BOOTSTRAP_ENV_KEYS.huggingFaceApiToken,
  }),
  Object.freeze({
    secretId: "secret:server:signing:identity-session",
    name: "signing.identity.session.private-key",
    kind: SecretKinds.privateKey,
    metadata: Object.freeze({
      tags: Object.freeze(["server", "signing", "identity-session"]),
      labels: Object.freeze({
        algorithm: "ed25519",
        usage: "token-signing",
      }),
    }),
    runtimePurpose: "identity-session-token-signing",
    runtimeConsumer: "server-signing",
    legacyEnvironmentVariable: SYSTEM_SECRET_BOOTSTRAP_ENV_KEYS.identitySessionSigningPrivateKey,
  }),
]);

const SystemSecretDefinitionsById = new Map(
  SystemSecretDefinitions.map((definition) => [definition.secretId, definition] as const),
);

export const SystemSecretBootstrapStates = Object.freeze({
  ready: "ready",
  invalid: "invalid",
});

export type SystemSecretBootstrapState =
  typeof SystemSecretBootstrapStates[keyof typeof SystemSecretBootstrapStates];

export const SystemSecretBootstrapDiagnosticCodes = Object.freeze({
  unsupportedRequiredSecret: "unsupported-required-secret",
  requiredSecretMissing: "required-secret-missing",
  legacyMigrationUnavailable: "legacy-migration-unavailable",
  legacyMigrationFailed: "legacy-migration-failed",
  requiredSecretUnusable: "required-secret-unusable",
});

export type SystemSecretBootstrapDiagnosticCode =
  typeof SystemSecretBootstrapDiagnosticCodes[keyof typeof SystemSecretBootstrapDiagnosticCodes];

export interface SystemSecretBootstrapDiagnostic {
  readonly code: SystemSecretBootstrapDiagnosticCode;
  readonly secretId: string;
  readonly message: string;
  readonly legacyEnvironmentVariable?: string;
}

export interface SystemSecretBootstrapResult {
  readonly state: SystemSecretBootstrapState;
  readonly requiredSecretIds: ReadonlyArray<string>;
  readonly migratedSecretIds: ReadonlyArray<string>;
  readonly diagnostics: ReadonlyArray<SystemSecretBootstrapDiagnostic>;
}

export interface BootstrapSystemSecretsFromEnvironmentInput {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly secretService: ServerComposedSecretService;
  readonly now?: () => Date;
}

export class SystemSecretBootstrapValidationError extends Error {
  public constructor(
    message: string,
    public readonly diagnostics: ReadonlyArray<SystemSecretBootstrapDiagnostic>,
  ) {
    super(message);
    this.name = "SystemSecretBootstrapValidationError";
  }
}

export async function bootstrapSystemSecretsFromEnvironment(
  input: BootstrapSystemSecretsFromEnvironmentInput,
): Promise<SystemSecretBootstrapResult> {
  const now = input.now ?? (() => new Date());
  const requiredSecretIds = parseOptionalCsvList(input.env[SYSTEM_SECRET_BOOTSTRAP_ENV_KEYS.requiredSecretIds]);
  if (requiredSecretIds.length === 0) {
    return Object.freeze({
      state: SystemSecretBootstrapStates.ready,
      requiredSecretIds,
      migratedSecretIds: Object.freeze([]),
      diagnostics: Object.freeze([]),
    });
  }

  const diagnostics: SystemSecretBootstrapDiagnostic[] = [];
  const migratedSecretIds: string[] = [];
  const migrationEnabled = parseOptionalBoolean(
    input.env[SYSTEM_SECRET_BOOTSTRAP_ENV_KEYS.migrateLegacyEnvironmentValues],
  ) ?? true;
  const administrativeActor = createAdministrativeActor();
  const platformSecretConsumers = new ServerPlatformSecretConsumers(
    input.secretService.runtimeSecretConsumptionAdapters,
  );

  for (const secretId of requiredSecretIds) {
    const definition = SystemSecretDefinitionsById.get(secretId);
    if (!definition) {
      diagnostics.push(Object.freeze({
        code: SystemSecretBootstrapDiagnosticCodes.unsupportedRequiredSecret,
        secretId,
        message: `Required system secret '${secretId}' is not registered for bootstrap.`,
      }));
      continue;
    }

    const existingMetadata = await input.secretService.getSecretMetadataUseCase.execute({
      actor: administrativeActor,
      secretId: definition.secretId,
      occurredAt: now().toISOString(),
    });

    if (!existingMetadata.ok) {
      const legacyEnvironmentVariable = definition.legacyEnvironmentVariable;
      const legacyValue = legacyEnvironmentVariable
        ? normalizeOptional(input.env[legacyEnvironmentVariable])
        : undefined;
      const canAttemptMigration = migrationEnabled && Boolean(legacyEnvironmentVariable && legacyValue);

      if (canAttemptMigration) {
        if (!input.secretService.status.configured) {
          diagnostics.push(Object.freeze({
            code: SystemSecretBootstrapDiagnosticCodes.legacyMigrationUnavailable,
            secretId: definition.secretId,
            legacyEnvironmentVariable,
            message: "Legacy secret migration requires secret encryption configuration.",
          }));
          continue;
        }

        const createResult = await input.secretService.createSecretUseCase.execute({
          actor: administrativeActor,
          operationKey: `op:system-secret-bootstrap:create:${definition.secretId}:${now().getTime()}`,
          secretId: definition.secretId,
          name: definition.name,
          owner: Object.freeze({
            scope: SecretScopes.server,
          }),
          kind: definition.kind,
          plaintext: legacyValue as string,
          metadata: definition.metadata,
          createdAt: now().toISOString(),
        });

        if (!createResult.ok) {
          diagnostics.push(Object.freeze({
            code: SystemSecretBootstrapDiagnosticCodes.legacyMigrationFailed,
            secretId: definition.secretId,
            legacyEnvironmentVariable,
            message: `Legacy secret migration failed (${createResult.error.code}).`,
          }));
          continue;
        }

        migratedSecretIds.push(definition.secretId);
      } else {
        diagnostics.push(Object.freeze({
          code: SystemSecretBootstrapDiagnosticCodes.requiredSecretMissing,
          secretId: definition.secretId,
          legacyEnvironmentVariable,
          message: "Required system secret is missing.",
        }));
        continue;
      }
    }

    const runtimeCheck = definition.runtimeConsumer === "provider-credential"
      ? await platformSecretConsumers.resolveServerProviderCredential({
        providerId: definition.providerId as "openai" | "huggingface",
        secretId: definition.secretId,
        operationKey: `op:system-secret-bootstrap:validate:${definition.secretId}:${now().getTime()}`,
        serviceIdentity: "runtime:server:system-secret-bootstrap",
        justification: `validate required system secret for '${definition.runtimePurpose}'`,
        occurredAt: now().toISOString(),
      })
      : await platformSecretConsumers.resolveIdentitySessionSigningMaterial({
        secretId: definition.secretId,
        operationKey: `op:system-secret-bootstrap:validate:${definition.secretId}:${now().getTime()}`,
        serviceIdentity: "runtime:server:system-secret-bootstrap",
        signingPurpose: definition.runtimePurpose,
        justification: `validate required system secret for '${definition.runtimePurpose}'`,
        occurredAt: now().toISOString(),
      });

    if (!runtimeCheck.ok) {
      diagnostics.push(Object.freeze({
        code: SystemSecretBootstrapDiagnosticCodes.requiredSecretUnusable,
        secretId: definition.secretId,
        message: `Required system secret could not be resolved for runtime use (${runtimeCheck.error.code}).`,
      }));
    }
  }

  const state = diagnostics.length > 0
    ? SystemSecretBootstrapStates.invalid
    : SystemSecretBootstrapStates.ready;

  return Object.freeze({
    state,
    requiredSecretIds,
    migratedSecretIds: Object.freeze([...new Set(migratedSecretIds)]),
    diagnostics: Object.freeze([...diagnostics]),
  });
}

export async function assertSystemSecretBootstrapSafe(
  input: BootstrapSystemSecretsFromEnvironmentInput,
): Promise<SystemSecretBootstrapResult> {
  const result = await bootstrapSystemSecretsFromEnvironment(input);
  if (result.state === SystemSecretBootstrapStates.invalid) {
    throw new SystemSecretBootstrapValidationError(
      "System secret bootstrap validation failed.",
      result.diagnostics,
    );
  }
  return result;
}

function createAdministrativeActor() {
  return Object.freeze({
    actorId: "system:secret-bootstrap",
    actorType: SecretActorTypes.serverAdmin,
    grantedActions: Object.freeze([
      SecretAccessActions.create,
      SecretAccessActions.readMetadata,
    ]),
  });
}

function parseOptionalCsvList(value: string | undefined): ReadonlyArray<string> {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return Object.freeze([]);
  }
  const entries = normalized
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return Object.freeze([...new Set(entries)]);
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return undefined;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
