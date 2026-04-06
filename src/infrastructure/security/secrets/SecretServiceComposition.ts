import path from "node:path";
import type { ISecretOperationalLogger } from "../../../application/security/ports/SecretObservabilityPorts";
import type {
  ISecretAccessAuditPort,
  ISecretAccessPolicyPort,
  ISecretEncryptionPort,
  SecretAccessAuditEvent,
} from "../../../application/security/ports/SecretServicePorts";
import { CreateSecretUseCase } from "../../../application/security/use-cases/CreateSecretUseCase";
import { DeleteSecretUseCase } from "../../../application/security/use-cases/DeleteSecretUseCase";
import { DisableSecretUseCase } from "../../../application/security/use-cases/DisableSecretUseCase";
import { GetSecretMetadataUseCase } from "../../../application/security/use-cases/GetSecretMetadataUseCase";
import { ListSecretsUseCase } from "../../../application/security/use-cases/ListSecretsUseCase";
import { RetrieveSecretPlaintextForRuntimeUseCase } from "../../../application/security/use-cases/RetrieveSecretPlaintextForRuntimeUseCase";
import { RotateSecretUseCase } from "../../../application/security/use-cases/RotateSecretUseCase";
import { SecretAuthorizationPolicyEvaluator } from "../../../application/security/use-cases/SecretAuthorizationPolicyEvaluator";
import { SecretScopeResolver } from "../../../application/security/use-cases/SecretScopeResolver";
import { SqliteSecretRecordPersistenceAdapter } from "../../persistence/security/SqliteSecretRecordPersistenceAdapter";
import { SecretObservabilityReporter } from "../SecretObservabilityReporter";
import { createEnvelopeSecretEncryptionPortFromEnvironment } from "./EnvelopeSecretEncryptionPort";

const SECRET_SERVICE_ENV_KEYS = Object.freeze({
  masterKeyId: "AI_LOOM_SECRET_MASTER_KEY_ID",
  masterKey: "AI_LOOM_SECRET_MASTER_KEY",
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
  readonly disableSecretUseCase: DisableSecretUseCase;
  readonly deleteSecretUseCase: DeleteSecretUseCase;
  readonly listSecretsUseCase: ListSecretsUseCase;
  readonly secretScopeResolver: SecretScopeResolver;
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
  const secretRecordRepository = new SqliteSecretRecordPersistenceAdapter(path.resolve(input.databasePath));
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
    retrieveSecretPlaintextForRuntimeUseCase: new RetrieveSecretPlaintextForRuntimeUseCase({
      secretRecordRepository,
      secretEncryptionPort,
      secretAccessPolicyPort: accessPolicyPort,
      secretAccessAuditPort: accessAuditPort,
      secretObservabilityPort: observabilityPort,
    }),
    rotateSecretUseCase: new RotateSecretUseCase({
      secretRecordRepository,
      secretEncryptionPort,
      secretAccessPolicyPort: accessPolicyPort,
      secretAccessAuditPort: accessAuditPort,
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
    status,
    dispose: () => {
      secretRecordRepository.dispose();
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
} {
  const masterKeyId = normalizeOptional(input.env[SECRET_SERVICE_ENV_KEYS.masterKeyId]);
  const masterKey = normalizeOptional(input.env[SECRET_SERVICE_ENV_KEYS.masterKey]);
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

  return {
    configured: true,
    port: createEnvelopeSecretEncryptionPortFromEnvironment({
      env: input.env,
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
