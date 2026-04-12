import path from "node:path";
import type { ISecretOperationalLogger } from "@application/security/ports/SecretObservabilityPorts";
import type {
  IEncryptionAtRestPolicyContextResolverPort,
  ResolvedEncryptionAtRestPolicyContext,
} from "@application/security/ports/EncryptionAtRestPolicyEvaluationPorts";
import type {
  ISecretAccessAuditPort,
  ISecretAccessPolicyPort,
  ISecretEncryptionPort,
  SecretAccessAuditEvent,
} from "@application/security/ports/SecretServicePorts";
import { CreateSecretUseCase } from "@application/security/use-cases/CreateSecretUseCase";
import { DeleteSecretUseCase } from "@application/security/use-cases/DeleteSecretUseCase";
import { DisableSecretUseCase } from "@application/security/use-cases/DisableSecretUseCase";
import { GetSecretMetadataUseCase } from "@application/security/use-cases/GetSecretMetadataUseCase";
import { ListSecretsUseCase } from "@application/security/use-cases/ListSecretsUseCase";
import { RetrieveSecretPlaintextForRuntimeUseCase } from "@application/security/use-cases/RetrieveSecretPlaintextForRuntimeUseCase";
import { ReEncryptSecretsUseCase } from "@application/security/use-cases/ReEncryptSecretsUseCase";
import { RotateSecretUseCase } from "@application/security/use-cases/RotateSecretUseCase";
import { SecretAuthorizationPolicyEvaluator } from "@application/security/use-cases/SecretAuthorizationPolicyEvaluator";
import { SecretScopeResolver } from "@application/security/use-cases/SecretScopeResolver";
import { SecretRuntimeConsumptionAdapters } from "@application/security/services/SecretRuntimeConsumptionAdapters";
import { EncryptionPolicyEvaluationService } from "@application/security/use-cases/EncryptionPolicyEvaluationService";
import { EncryptionKeyResolutionService } from "@application/security/use-cases/EncryptionKeyResolutionService";
import { SqliteSecretRecordPersistenceAdapter } from "../../persistence/security/SqliteSecretRecordPersistenceAdapter";
import { ProtectedSecretRecordPersistenceRepository } from "../../persistence/security/ProtectedSecretRecordPersistenceRepository";
import { SecretObservabilityReporter } from "../SecretObservabilityReporter";
import { StaticEncryptionKeyCatalogPort } from "../encryption/StaticEncryptionKeyCatalogPort";
import { StaticEncryptionKeyMaterialPort } from "../encryption/StaticEncryptionKeyMaterialPort";
import { VersionedAesGcmProtectedValueEncryptionPort } from "../encryption/VersionedAesGcmProtectedValueEncryptionPort";
import { createProtectedValueSecretEncryptionPort } from "./ProtectedValueSecretEncryptionPort";
import {
  EncryptionKeyLifecycleStates,
  type EncryptionKeyDescriptor,
} from "@application/security/ports/EncryptionKeyResolutionPorts";
import {
  createEncryptionAtRestPolicyDefinition,
  EncryptionKeyScopes,
  EncryptionModes,
  EncryptionPolicyScopes,
  ProtectedDataClasses,
  type EncryptionAtRestPolicyDefinition,
} from "@domain/security/EncryptionAtRestPolicyDomain";

const SECRET_SERVICE_ENV_KEYS = Object.freeze({
  masterKeyId: "AI_LOOM_SECRET_MASTER_KEY_ID",
  masterKey: "AI_LOOM_SECRET_MASTER_KEY",
  masterKeyVersion: "AI_LOOM_SECRET_MASTER_KEY_VERSION",
  encryptionKeyReferenceId: "AI_LOOM_SECRET_ENCRYPTION_KEY_REFERENCE_ID",
  encryptedPayloadDirectory: "AI_LOOM_SECRET_ENCRYPTED_PAYLOAD_DIRECTORY",
});

export interface SecretServiceCompositionStatus {
  readonly configured: boolean;
  readonly payloadDirectory: string;
  readonly reason?: string;
}

export interface ServerComposedSecretService {
  readonly createSecretUseCase: CreateSecretUseCase;
  readonly getSecretMetadataUseCase: GetSecretMetadataUseCase;
  readonly retrieveSecretPlaintextForRuntimeUseCase: RetrieveSecretPlaintextForRuntimeUseCase;
  readonly rotateSecretUseCase: RotateSecretUseCase;
  readonly reEncryptSecretsUseCase: ReEncryptSecretsUseCase;
  readonly disableSecretUseCase: DisableSecretUseCase;
  readonly deleteSecretUseCase: DeleteSecretUseCase;
  readonly listSecretsUseCase: ListSecretsUseCase;
  readonly secretScopeResolver: SecretScopeResolver;
  readonly secretAccessPolicyPort: ISecretAccessPolicyPort;
  readonly runtimeSecretConsumptionAdapters: SecretRuntimeConsumptionAdapters;
  readonly status: SecretServiceCompositionStatus;
  dispose(): void;
}

export interface ComposeServerSecretServiceInput {
  readonly databasePath: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly observabilityLogger?: ISecretOperationalLogger;
  readonly auditHook?: (event: SecretAccessAuditEvent) => Promise<void> | void;
}

export function composeServerSecretService(input: ComposeServerSecretServiceInput): ServerComposedSecretService {
  const baseSecretRecordRepository = new SqliteSecretRecordPersistenceAdapter(path.resolve(input.databasePath));
  const payloadDirectory = resolveSecretPayloadDirectory({
    databasePath: input.databasePath,
    env: input.env,
  });
  const accessPolicyPort = new DomainSecretAccessPolicyPort();
  const accessAuditPort = new CallbackSecretAccessAuditPort(input.auditHook);
  const observabilityPort = new SecretObservabilityReporter({
    logger: input.observabilityLogger,
  });
  const encryptionConfiguration = resolveSecretEncryptionPort({
    env: input.env,
    payloadDirectory,
  });
  const secretEncryptionPort = encryptionConfiguration.port;
  const secretRecordRepository = encryptionConfiguration.protectedValueEncryptionPort
    && encryptionConfiguration.encryptionKeyResolutionService
    ? new ProtectedSecretRecordPersistenceRepository(
      baseSecretRecordRepository,
      encryptionConfiguration.encryptionKeyResolutionService,
      encryptionConfiguration.protectedValueEncryptionPort,
    )
    : baseSecretRecordRepository;
  const retrieveSecretPlaintextForRuntimeUseCase = new RetrieveSecretPlaintextForRuntimeUseCase({
    secretRecordRepository,
    secretEncryptionPort,
    secretAccessPolicyPort: accessPolicyPort,
    secretAccessAuditPort: accessAuditPort,
    secretObservabilityPort: observabilityPort,
  });
  const status: SecretServiceCompositionStatus = Object.freeze({
    configured: encryptionConfiguration.configured,
    payloadDirectory,
    reason: encryptionConfiguration.reason,
  });

  return Object.freeze({
    createSecretUseCase: new CreateSecretUseCase({
      secretRecordRepository,
      secretEncryptionPort,
      secretAccessPolicyPort: accessPolicyPort,
      secretAccessAuditPort: accessAuditPort,
      secretObservabilityPort: observabilityPort,
    }),
    getSecretMetadataUseCase: new GetSecretMetadataUseCase({
      secretRecordRepository,
      secretAccessPolicyPort: accessPolicyPort,
      secretAccessAuditPort: accessAuditPort,
      secretObservabilityPort: observabilityPort,
    }),
    retrieveSecretPlaintextForRuntimeUseCase,
    rotateSecretUseCase: new RotateSecretUseCase({
      secretRecordRepository,
      secretEncryptionPort,
      secretAccessPolicyPort: accessPolicyPort,
      secretAccessAuditPort: accessAuditPort,
      secretObservabilityPort: observabilityPort,
    }),
    reEncryptSecretsUseCase: new ReEncryptSecretsUseCase({
      secretRecordRepository,
      secretEncryptionPort,
      secretAccessPolicyPort: accessPolicyPort,
      secretAccessAuditPort: accessAuditPort,
      reEncryptionOperationRepository: secretRecordRepository,
      secretObservabilityPort: observabilityPort,
    }),
    disableSecretUseCase: new DisableSecretUseCase({
      secretRecordRepository,
      secretAccessPolicyPort: accessPolicyPort,
      secretAccessAuditPort: accessAuditPort,
      secretObservabilityPort: observabilityPort,
    }),
    deleteSecretUseCase: new DeleteSecretUseCase({
      secretRecordRepository,
      secretAccessPolicyPort: accessPolicyPort,
      secretAccessAuditPort: accessAuditPort,
      secretObservabilityPort: observabilityPort,
    }),
    listSecretsUseCase: new ListSecretsUseCase({
      secretRecordRepository,
      secretAccessPolicyPort: accessPolicyPort,
      secretAccessAuditPort: accessAuditPort,
      secretObservabilityPort: observabilityPort,
    }),
    secretScopeResolver: new SecretScopeResolver({
      secretRecordRepository,
      secretAccessPolicyPort: accessPolicyPort,
    }),
    secretAccessPolicyPort: accessPolicyPort,
    runtimeSecretConsumptionAdapters: new SecretRuntimeConsumptionAdapters(retrieveSecretPlaintextForRuntimeUseCase),
    status,
    dispose: () => {
      baseSecretRecordRepository.dispose();
    },
  });
}

class DomainSecretAccessPolicyPort implements ISecretAccessPolicyPort {
  private readonly evaluator = new SecretAuthorizationPolicyEvaluator();

  public async evaluateSecretAccess(input: Parameters<ISecretAccessPolicyPort["evaluateSecretAccess"]>[0]) {
    return this.evaluator.evaluateSecretAccess(input);
  }
}

class CallbackSecretAccessAuditPort implements ISecretAccessAuditPort {
  public constructor(
    private readonly hook?: (event: SecretAccessAuditEvent) => Promise<void> | void,
  ) {}

  public async recordSecretAuditEvent(event: SecretAccessAuditEvent): Promise<void> {
    if (!this.hook) {
      return;
    }
    await this.hook(event);
  }
}

class UnconfiguredSecretEncryptionPort implements ISecretEncryptionPort {
  public constructor(private readonly reason: string) {}

  public async encryptSecretPlaintext(): Promise<never> {
    throw new Error(this.reason);
  }

  public async decryptSecretPlaintext(): Promise<never> {
    throw new Error(this.reason);
  }
}

function resolveSecretEncryptionPort(input: {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly payloadDirectory: string;
}): {
  readonly configured: boolean;
  readonly reason?: string;
  readonly port: ISecretEncryptionPort;
  readonly encryptionKeyResolutionService?: EncryptionKeyResolutionService;
  readonly protectedValueEncryptionPort?: VersionedAesGcmProtectedValueEncryptionPort;
} {
  const masterKeyId = normalizeOptional(input.env[SECRET_SERVICE_ENV_KEYS.masterKeyId]);
  const masterKey = normalizeOptional(input.env[SECRET_SERVICE_ENV_KEYS.masterKey]);
  const masterKeyVersion = normalizeOptional(input.env[SECRET_SERVICE_ENV_KEYS.masterKeyVersion]);
  const keyReferenceId = normalizeOptional(input.env[SECRET_SERVICE_ENV_KEYS.encryptionKeyReferenceId]) ?? masterKeyId;
  if (!masterKeyId && !masterKey) {
    return {
      configured: false,
      reason: "Secret encryption is disabled because no master key configuration is set.",
      port: new UnconfiguredSecretEncryptionPort(
        "Secret encryption is not configured. Set AI_LOOM_SECRET_MASTER_KEY_ID and AI_LOOM_SECRET_MASTER_KEY.",
      ),
    };
  }

  if (!masterKeyId || !masterKey) {
    throw new Error(
      "Secret encryption configuration is incomplete. Set both AI_LOOM_SECRET_MASTER_KEY_ID and AI_LOOM_SECRET_MASTER_KEY.",
    );
  }

  const encryptionKey: EncryptionKeyDescriptor = Object.freeze({
    keyReferenceId: keyReferenceId as string,
    keyId: masterKeyId as string,
    keyVersion: masterKeyVersion,
    algorithm: "aes-256-gcm",
    scopeOwner: Object.freeze({
      scope: EncryptionKeyScopes.server,
    }),
    lifecycleState: EncryptionKeyLifecycleStates.active,
    activatedAt: "2026-01-01T00:00:00.000Z",
  });
  const encryptionPolicyContextResolver = new StaticSecretEncryptionPolicyContextResolver();
  const encryptionPolicyEvaluationService = new EncryptionPolicyEvaluationService({
    encryptionAtRestPolicyContextResolverPort: encryptionPolicyContextResolver,
  });
  const encryptionKeyResolutionService = new EncryptionKeyResolutionService({
    encryptionPolicyEvaluationService,
    encryptionKeyCatalogPort: new StaticEncryptionKeyCatalogPort({
      keys: [encryptionKey],
    }),
  });
  const protectedValueEncryptionPort = new VersionedAesGcmProtectedValueEncryptionPort({
    encryptionKeyMaterialPort: new StaticEncryptionKeyMaterialPort({
      keyMaterials: [Object.freeze({
        keyReferenceId: encryptionKey.keyReferenceId,
        algorithm: "aes-256-gcm",
        encodedKey: masterKey as string,
      })],
    }),
  });

  return {
    configured: true,
    encryptionKeyResolutionService,
    protectedValueEncryptionPort,
    port: createProtectedValueSecretEncryptionPort({
      encryptionKeyResolutionService,
      protectedValueEncryptionPort,
      payloadStoreDirectory: input.payloadDirectory,
    }),
  };
}

function resolveSecretPayloadDirectory(input: {
  readonly databasePath: string;
  readonly env: Readonly<Record<string, string | undefined>>;
}): string {
  const configured = normalizeOptional(input.env[SECRET_SERVICE_ENV_KEYS.encryptedPayloadDirectory]);
  if (configured) {
    return path.resolve(configured);
  }
  return path.resolve(path.dirname(path.resolve(input.databasePath)), "secret-envelopes");
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

class StaticSecretEncryptionPolicyContextResolver implements IEncryptionAtRestPolicyContextResolverPort {
  private readonly platformPolicy: EncryptionAtRestPolicyDefinition;

  public constructor() {
    this.platformPolicy = createEncryptionAtRestPolicyDefinition({
      policyId: "policy:platform:secret-service-default",
      scope: EncryptionPolicyScopes.platform,
      rules: Object.freeze([
        Object.freeze({
          dataClass: ProtectedDataClasses.secretMaterial,
          encryptionMode: EncryptionModes.scopedContent,
          keyScope: EncryptionKeyScopes.server,
          decryption: Object.freeze({
            allowPreview: false,
            allowWorker: false,
          }),
        }),
        Object.freeze({
          dataClass: ProtectedDataClasses.secretMetadata,
          encryptionMode: EncryptionModes.metadataOnly,
          keyScope: EncryptionKeyScopes.server,
          decryption: Object.freeze({
            allowPreview: false,
            allowWorker: false,
          }),
        }),
        Object.freeze({
          dataClass: ProtectedDataClasses.sensitiveMetadata,
          encryptionMode: EncryptionModes.metadataOnly,
          keyScope: EncryptionKeyScopes.server,
          decryption: Object.freeze({
            allowPreview: false,
            allowWorker: false,
          }),
        }),
      ]),
    });
  }

  public async resolvePolicyContext(): Promise<ResolvedEncryptionAtRestPolicyContext> {
    return Object.freeze({
      platformPolicy: this.platformPolicy,
      workspacePolicy: undefined,
      storageInstancePolicy: undefined,
    });
  }
}

