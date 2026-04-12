import type { HostDeploymentProfile } from "@hosts/bootstrap/HostBootstrapPipeline";
import type { IIdentityClock } from "@application/identity/ports/IIdentityClock";
import { AuthoritativeAuditRecordingService } from "@application/audit/use-cases/AuthoritativeAuditRecordingService";
import {
  ReconcileAuditLedgerStartupStateUseCase,
  type ReconcileAuditLedgerStartupStateResult,
} from "@application/audit/use-cases/ReconcileAuditLedgerStartupStateUseCase";
import { AuditLedgerQueryService } from "@application/audit/use-cases/AuditLedgerQueryService";
import { WorkspaceAuditLedgerReadAuthorizer } from "@application/audit/use-cases/WorkspaceAuditLedgerReadAuthorizer";
import { resolveAuditRetentionLifecycleConfig } from "@infrastructure/config/AuditRetentionLifecycleConfig";
import {
  FanoutRunSubmissionAuditSink,
} from "@infrastructure/audit/AuditFanoutPublishers";
import { AuthoritativeExecutionNodeManagementAuditSink } from "@infrastructure/audit/AuthoritativeExecutionNodeManagementAuditSink";
import { AuthoritativeRunSubmissionAuditSink } from "@infrastructure/audit/AuthoritativeRunSubmissionAuditSink";
import { AuditLedgerObservability } from "@infrastructure/api/audit/AuditLedgerObservability";
import { AuditLedgerBackendApi } from "@infrastructure/api/audit/AuditLedgerBackendApi";
import { RunOrchestrationObservability } from "@infrastructure/api/runs/RunOrchestrationObservability";
import { PlatformRunSubmissionAuditSink } from "@infrastructure/api/runs/PlatformRunSubmissionAuditSink";
import type { AuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";

export interface ServerOperationalEventLogger {
  info(event: Readonly<Record<string, unknown>>): void;
  warn(event: Readonly<Record<string, unknown>>): void;
  error(event: Readonly<Record<string, unknown>>): void;
}

export interface ServerAuditDiagnosticsPlatformCompositionModuleInput {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly deploymentProfile?: HostDeploymentProfile;
  readonly persistentPlatformServices: AuthoritativePersistentPlatformServices;
  readonly logger?: ServerOperationalEventLogger;
}

export interface ServerAuditDiagnosticsPlatformCompositionModuleOutput {
  readonly authoritativeAuditRecorder: AuthoritativeAuditRecordingService;
  readonly auditLedgerObservability: AuditLedgerObservability;
  readonly runOrchestrationObservability: RunOrchestrationObservability;
  readonly runSubmissionAuditSink: FanoutRunSubmissionAuditSink;
  readonly executionNodeManagementAuditSink: AuthoritativeExecutionNodeManagementAuditSink;
  readonly secretOperationalLogger?: ServerOperationalEventLogger;
  readonly runOrchestrationOperationalLogger?: ServerOperationalEventLogger;
  readonly deploymentPolicyAdministrationOperationalLogger?: ServerOperationalEventLogger;
  readonly auditLedgerOperationalLogger?: ServerOperationalEventLogger;
  readonly encryptionOperationalLogger?: ServerOperationalEventLogger;
  readonly imageAssetManagementOperationalLogger?: ServerOperationalEventLogger;
  readonly legacySecretAccessAuditHook?: (event: Record<string, unknown>) => void;
  createAuditLedgerBackendApi(input: {
    readonly workspaceClock: IIdentityClock;
  }): AuditLedgerBackendApi;
  reconcileAuditLedgerStartupState(input: {
    readonly workspaceClock: IIdentityClock;
  }): Promise<ReconcileAuditLedgerStartupStateResult>;
}

export function composeServerAuditDiagnosticsPlatformCompositionModule(
  input: ServerAuditDiagnosticsPlatformCompositionModuleInput,
): ServerAuditDiagnosticsPlatformCompositionModuleOutput {
  const auditRetentionLifecycleConfig = resolveAuditRetentionLifecycleConfig({
    env: input.env,
    deploymentProfile: input.deploymentProfile
      ? {
        profileId: input.deploymentProfile.profileId,
      }
      : undefined,
  });
  const auditLedgerOperationalLogger = createAuditLedgerOperationalLogger(input.logger);
  const runOrchestrationOperationalLogger = createRunOrchestrationOperationalLogger(input.logger);
  const auditLedgerObservability = new AuditLedgerObservability({
    logger: auditLedgerOperationalLogger,
  });
  const authoritativeAuditRecorder = new AuthoritativeAuditRecordingService({
    repository: input.persistentPlatformServices.auditLedgerRepository,
    observabilityPort: auditLedgerObservability,
    retentionLifecycleDefaults: {
      policyKey: auditRetentionLifecycleConfig.defaultPolicyKey,
      policyVersion: auditRetentionLifecycleConfig.defaultPolicyVersion,
      retentionAnchor: auditRetentionLifecycleConfig.defaultRetentionAnchor,
    },
  });
  const runSubmissionAuditSink = new FanoutRunSubmissionAuditSink([
    new PlatformRunSubmissionAuditSink(input.persistentPlatformServices.platformPersistenceRepository),
    new AuthoritativeRunSubmissionAuditSink(authoritativeAuditRecorder),
  ]);
  const executionNodeManagementAuditSink = new AuthoritativeExecutionNodeManagementAuditSink(
    authoritativeAuditRecorder,
  );
  const runOrchestrationObservability = new RunOrchestrationObservability({
    logger: runOrchestrationOperationalLogger,
  });

  return Object.freeze({
    authoritativeAuditRecorder,
    auditLedgerObservability,
    runOrchestrationObservability,
    runSubmissionAuditSink,
    executionNodeManagementAuditSink,
    secretOperationalLogger: createSecretOperationalLogger(input.logger),
    runOrchestrationOperationalLogger,
    deploymentPolicyAdministrationOperationalLogger: createDeploymentPolicyAdministrationOperationalLogger(input.logger),
    auditLedgerOperationalLogger,
    encryptionOperationalLogger: createEncryptionOperationalLogger(input.logger),
    imageAssetManagementOperationalLogger: createImageAssetManagementOperationalLogger(input.logger),
    legacySecretAccessAuditHook: createLegacySecretAccessAuditHook(input.logger),
    createAuditLedgerBackendApi: (apiInput) => new AuditLedgerBackendApi({
      auditLedgerQueryService: new AuditLedgerQueryService({
        repository: input.persistentPlatformServices.auditLedgerRepository,
        authorizer: new WorkspaceAuditLedgerReadAuthorizer({
          workspaceAuthorizationReadRepository: input.persistentPlatformServices.workspaceRepository,
          clock: apiInput.workspaceClock,
        }),
      }),
      observability: auditLedgerObservability,
    }),
    reconcileAuditLedgerStartupState: async (reconcileInput) => new ReconcileAuditLedgerStartupStateUseCase({
      repository: input.persistentPlatformServices.auditLedgerRepository,
      observabilityPort: auditLedgerObservability,
      now: () => reconcileInput.workspaceClock.now(),
    }).execute(),
  });
}

function createSecretOperationalLogger(logger: ServerOperationalEventLogger | undefined): ServerOperationalEventLogger | undefined {
  if (!logger) {
    return undefined;
  }

  return Object.freeze({
    info: (event: Record<string, unknown>) => {
      logger.info({
        event: "secret.operation",
        requestId: resolveOptionalString(event.secretId) ?? resolveOptionalString(event.actorId),
        details: Object.freeze({
          secret: event,
        }),
      });
    },
    warn: (event: Record<string, unknown>) => {
      logger.warn({
        event: "secret.operation",
        requestId: resolveOptionalString(event.secretId) ?? resolveOptionalString(event.actorId),
        details: Object.freeze({
          secret: event,
        }),
      });
    },
    error: (event: Record<string, unknown>) => {
      logger.error({
        event: "secret.operation",
        requestId: resolveOptionalString(event.secretId) ?? resolveOptionalString(event.actorId),
        details: Object.freeze({
          secret: event,
        }),
      });
    },
  });
}

function createRunOrchestrationOperationalLogger(
  logger: ServerOperationalEventLogger | undefined,
): ServerOperationalEventLogger | undefined {
  if (!logger) {
    return undefined;
  }

  return Object.freeze({
    info: (event: Record<string, unknown>) => {
      logger.info({
        event: resolveOptionalString(event.event) ?? "run.orchestration.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.runId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          orchestration: event,
        }),
      });
    },
    warn: (event: Record<string, unknown>) => {
      logger.warn({
        event: resolveOptionalString(event.event) ?? "run.orchestration.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.runId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          orchestration: event,
        }),
      });
    },
    error: (event: Record<string, unknown>) => {
      logger.error({
        event: resolveOptionalString(event.event) ?? "run.orchestration.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.runId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          orchestration: event,
        }),
      });
    },
  });
}

function createDeploymentPolicyAdministrationOperationalLogger(
  logger: ServerOperationalEventLogger | undefined,
): ServerOperationalEventLogger | undefined {
  if (!logger) {
    return undefined;
  }

  return Object.freeze({
    info: (event: Readonly<Record<string, unknown>>) => {
      logger.info({
        event: resolveOptionalString(event.event) ?? "deployment-policy-admin.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.operationKey)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          deploymentPolicyAdministration: event,
        }),
      });
    },
    warn: (event: Readonly<Record<string, unknown>>) => {
      logger.warn({
        event: resolveOptionalString(event.event) ?? "deployment-policy-admin.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.operationKey)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          deploymentPolicyAdministration: event,
        }),
      });
    },
    error: (event: Readonly<Record<string, unknown>>) => {
      logger.error({
        event: resolveOptionalString(event.event) ?? "deployment-policy-admin.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.operationKey)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          deploymentPolicyAdministration: event,
        }),
      });
    },
  });
}

function createAuditLedgerOperationalLogger(
  logger: ServerOperationalEventLogger | undefined,
): ServerOperationalEventLogger | undefined {
  if (!logger) {
    return undefined;
  }

  return Object.freeze({
    info: (event: Record<string, unknown>) => {
      logger.info({
        event: resolveOptionalString(event.event) ?? "audit-ledger.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.eventId)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          auditLedger: event,
        }),
      });
    },
    warn: (event: Record<string, unknown>) => {
      logger.warn({
        event: resolveOptionalString(event.event) ?? "audit-ledger.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.eventId)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          auditLedger: event,
        }),
      });
    },
    error: (event: Record<string, unknown>) => {
      logger.error({
        event: resolveOptionalString(event.event) ?? "audit-ledger.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.eventId)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          auditLedger: event,
        }),
      });
    },
  });
}

function createEncryptionOperationalLogger(
  logger: ServerOperationalEventLogger | undefined,
): ServerOperationalEventLogger | undefined {
  if (!logger) {
    return undefined;
  }

  return Object.freeze({
    info: (event: Record<string, unknown>) => {
      logger.info({
        event: "encryption.enforcement",
        requestId: resolveOptionalString(event.operationKey)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.workspaceId)
          ?? resolveOptionalString(event.event),
        details: Object.freeze({
          encryption: event,
        }),
      });
    },
    warn: (event: Record<string, unknown>) => {
      logger.warn({
        event: "encryption.enforcement",
        requestId: resolveOptionalString(event.operationKey)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.workspaceId)
          ?? resolveOptionalString(event.event),
        details: Object.freeze({
          encryption: event,
        }),
      });
    },
    error: (event: Record<string, unknown>) => {
      logger.error({
        event: "encryption.enforcement",
        requestId: resolveOptionalString(event.operationKey)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.workspaceId)
          ?? resolveOptionalString(event.event),
        details: Object.freeze({
          encryption: event,
        }),
      });
    },
  });
}

function createImageAssetManagementOperationalLogger(
  logger: ServerOperationalEventLogger | undefined,
): ServerOperationalEventLogger | undefined {
  if (!logger) {
    return undefined;
  }

  return Object.freeze({
    info: (event: Record<string, unknown>) => {
      logger.info({
        event: resolveOptionalString(event.event) ?? "image-asset-management.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.operationKey)
          ?? resolveOptionalString(event.assetId)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          imageAssetManagement: event,
        }),
      });
    },
    warn: (event: Record<string, unknown>) => {
      logger.warn({
        event: resolveOptionalString(event.event) ?? "image-asset-management.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.operationKey)
          ?? resolveOptionalString(event.assetId)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          imageAssetManagement: event,
        }),
      });
    },
    error: (event: Record<string, unknown>) => {
      logger.error({
        event: resolveOptionalString(event.event) ?? "image-asset-management.operation",
        requestId: resolveOptionalString(event.requestId)
          ?? resolveOptionalString(event.correlationId)
          ?? resolveOptionalString(event.operationKey)
          ?? resolveOptionalString(event.assetId)
          ?? resolveOptionalString(event.workspaceId),
        details: Object.freeze({
          imageAssetManagement: event,
        }),
      });
    },
  });
}

function createLegacySecretAccessAuditHook(
  logger: ServerOperationalEventLogger | undefined,
): ((event: Record<string, unknown>) => void) | undefined {
  if (!logger) {
    return undefined;
  }

  return (event) => {
    const eventKind = resolveOptionalString(event.eventKind) ?? "secret.audit";
    const actor = (typeof event.actor === "object" && event.actor) ? event.actor as Record<string, unknown> : undefined;
    const target = (typeof event.target === "object" && event.target) ? event.target as Record<string, unknown> : undefined;
    const status = resolveOptionalString(event.status);
    const decision = resolveOptionalString(event.decision);
    const level = decision === "denied" || status === "denied" || status === "failed" ? "warn" : "info";
    const requestId = resolveOptionalString(target?.secretId)
      ?? resolveOptionalString(actor?.actorId)
      ?? resolveOptionalString(event.operation)
      ?? eventKind;
    logger[level]({
      event: eventKind,
      requestId,
      details: Object.freeze({
        secret: Object.freeze({
          operation: resolveOptionalString(event.operation),
          action: resolveOptionalString(event.action),
          status,
          decision,
          reasonCode: resolveOptionalString(event.reasonCode),
          reason: resolveOptionalString(event.reason),
          operationKey: resolveOptionalString(event.operationKey),
          serviceIdentity: resolveOptionalString(event.serviceIdentity),
          actorId: resolveOptionalString(actor?.actorId),
          actorType: resolveOptionalString(actor?.actorType),
          actorWorkspaceId: resolveOptionalString(actor?.workspaceId),
          actorUserIdentityId: resolveOptionalString(actor?.userIdentityId),
          secretId: resolveOptionalString(target?.secretId),
          scope: resolveOptionalString(target?.scope),
          targetWorkspaceId: resolveOptionalString(target?.workspaceId),
          targetUserIdentityId: resolveOptionalString(target?.userIdentityId),
          occurredAt: resolveOptionalString(event.occurredAt),
        }),
      }),
    });
  };
}

function resolveOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}
