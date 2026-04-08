import {
  DeploymentPolicyEvaluationRequestLayers,
  resolveDeploymentPolicyAdministrationSnapshotWithOverrides,
} from "@application/deployment/DeploymentPolicyAdministrationContracts";
import type {
  DeploymentPolicyAdminOverrideRecord,
} from "@application/deployment/DeploymentPolicyEffectiveResolutionService";
import type { IDeploymentPolicyPersistenceRepository } from "@application/deployment/ports/IDeploymentPolicyPersistenceRepository";
import { DeploymentProfileIds, type DeploymentPolicyConfigurationRegistry, createCanonicalDeploymentPolicyConfigurationRegistry } from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import { CanonicalDeploymentPolicySnapshotResolver } from "@application/policy-administration/CanonicalDeploymentPolicySnapshotResolver";
import type { DeploymentPolicyEvaluationContext } from "@application/policy-administration/DeploymentPolicyEvaluationContracts";
import { DeploymentPolicyEvaluationService } from "@application/policy-administration/DeploymentPolicyEvaluationService";
import type { IDeploymentPolicyEvaluationService } from "@application/policy-administration/DeploymentPolicyEvaluationPorts";
import {
  DeploymentPolicyPersistenceScopeKinds,
  createDeploymentPolicyPersistenceScope,
  type DeploymentPolicyActiveProfileSelectionRecord,
  type DeploymentPolicyOverridePersistenceRecord,
  type DeploymentPolicyPersistenceScope,
} from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";
import type { DeploymentPolicyAdministrationSnapshot } from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import {
  DeploymentPolicyAdministrationObservabilityOperations,
  DeploymentPolicyAdministrationObservabilityOutcomes,
  publishDeploymentPolicyAdministrationObservabilityBestEffort,
  type IDeploymentPolicyAdministrationObservabilityPort,
} from "@application/policy-administration/ports/DeploymentPolicyAdministrationObservabilityPorts";

export const DeploymentPolicyBootstrapResolutionErrorCodes = Object.freeze({
  invalidPersistedState: "invalid-persisted-state",
});

export type DeploymentPolicyBootstrapResolutionErrorCode =
  typeof DeploymentPolicyBootstrapResolutionErrorCodes[keyof typeof DeploymentPolicyBootstrapResolutionErrorCodes];

export const DeploymentPolicyBootstrapActiveProfileSourceKinds = Object.freeze({
  persistedSelection: "persisted-selection",
  defaultFallback: "default-fallback",
});

export type DeploymentPolicyBootstrapActiveProfileSourceKind =
  typeof DeploymentPolicyBootstrapActiveProfileSourceKinds[keyof typeof DeploymentPolicyBootstrapActiveProfileSourceKinds];

export interface DeploymentPolicyBootstrapEvaluationContextResolver {
  resolveContext(input: {
    readonly workspaceId?: string;
    readonly workspaceSlug?: string;
    readonly actorUserIdentityId?: string;
    readonly actorServiceId?: string;
    readonly occurredAt: string;
  }): Promise<DeploymentPolicyEvaluationContext>;
}

export interface DeploymentPolicyBootstrapResolutionResult {
  readonly scope: DeploymentPolicyPersistenceScope;
  readonly activeProfile: {
    readonly profileId: typeof DeploymentProfileIds[keyof typeof DeploymentProfileIds];
    readonly source: DeploymentPolicyBootstrapActiveProfileSourceKind;
    readonly selectionRecord?: DeploymentPolicyActiveProfileSelectionRecord;
  };
  readonly overrideRecords: ReadonlyArray<DeploymentPolicyOverridePersistenceRecord>;
  readonly evaluationContext: DeploymentPolicyEvaluationContext;
  readonly evaluationService: IDeploymentPolicyEvaluationService;
  readonly snapshot: DeploymentPolicyAdministrationSnapshot;
  readonly validation: ReturnType<typeof resolveDeploymentPolicyAdministrationSnapshotWithOverrides>["validation"];
  readonly contextResolver: DeploymentPolicyBootstrapEvaluationContextResolver;
}

export interface DeploymentPolicyBootstrapResolutionServiceDependencies {
  readonly deploymentPolicyRepository: IDeploymentPolicyPersistenceRepository;
  readonly scope?: DeploymentPolicyPersistenceScope;
  readonly fallbackProfileId?: typeof DeploymentProfileIds[keyof typeof DeploymentProfileIds];
  readonly configurationRegistry?: DeploymentPolicyConfigurationRegistry;
  readonly observabilityPort?: IDeploymentPolicyAdministrationObservabilityPort;
  readonly now?: () => Date;
}

export interface DeploymentPolicyBootstrapResolutionErrorMetadata {
  readonly scope: DeploymentPolicyPersistenceScope;
  readonly activeProfileId: typeof DeploymentProfileIds[keyof typeof DeploymentProfileIds];
  readonly validationIssues: ReadonlyArray<{
    readonly code: string;
    readonly path: string;
    readonly familyId?: string;
    readonly settingKey?: string;
    readonly message: string;
  }>;
}

const DefaultScopeId = "platform:default";

export class DeploymentPolicyBootstrapResolutionError extends Error {
  public readonly code: DeploymentPolicyBootstrapResolutionErrorCode;
  public readonly metadata: DeploymentPolicyBootstrapResolutionErrorMetadata;

  public constructor(
    message: string,
    input: {
      readonly code: DeploymentPolicyBootstrapResolutionErrorCode;
      readonly metadata: DeploymentPolicyBootstrapResolutionErrorMetadata;
    },
  ) {
    super(message);
    this.name = "DeploymentPolicyBootstrapResolutionError";
    this.code = input.code;
    this.metadata = input.metadata;
  }
}

export class DeploymentPolicyBootstrapResolutionService {
  private readonly scope: DeploymentPolicyPersistenceScope;
  private readonly fallbackProfileId: typeof DeploymentProfileIds[keyof typeof DeploymentProfileIds];
  private readonly configurationRegistry: DeploymentPolicyConfigurationRegistry;
  private readonly now: () => Date;

  public constructor(private readonly dependencies: DeploymentPolicyBootstrapResolutionServiceDependencies) {
    this.scope = dependencies.scope ?? createDeploymentPolicyPersistenceScope({
      kind: DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope,
      scopeId: DefaultScopeId,
    });
    this.fallbackProfileId = dependencies.fallbackProfileId ?? DeploymentProfileIds.home;
    this.configurationRegistry = dependencies.configurationRegistry ?? createCanonicalDeploymentPolicyConfigurationRegistry();
    this.now = dependencies.now ?? (() => new Date());
  }

  public async execute(): Promise<DeploymentPolicyBootstrapResolutionResult> {
    const occurredAt = this.now().toISOString();
    try {
      const selection = await this.dependencies.deploymentPolicyRepository.getActiveProfileSelection(this.scope);
      const activeProfileId = selection?.profileId ?? this.fallbackProfileId;
      const source = selection
        ? DeploymentPolicyBootstrapActiveProfileSourceKinds.persistedSelection
        : DeploymentPolicyBootstrapActiveProfileSourceKinds.defaultFallback;

      const overrideRecords = await this.dependencies.deploymentPolicyRepository.listOverrideRecords({
        scope: this.scope,
        profileId: activeProfileId,
      });

      const overrideRecordsForResolution = overrideRecords.map((record) => this.toAdminOverrideRecord(record));
      const evaluatedAt = this.now().toISOString();
      const resolved = resolveDeploymentPolicyAdministrationSnapshotWithOverrides({
        profileId: activeProfileId,
        familyCatalog: this.configurationRegistry.familyCatalog,
        presetCatalog: this.configurationRegistry.presetCatalog,
        overrideRecords: overrideRecordsForResolution,
        evaluationLayer: DeploymentPolicyEvaluationRequestLayers.application,
        evaluatedAt,
      });

      if (!resolved.validation.valid) {
        const error = new DeploymentPolicyBootstrapResolutionError(
          `Invalid persisted deployment policy state for scope '${this.scope.scopeId}' and profile '${activeProfileId}'.`,
          {
            code: DeploymentPolicyBootstrapResolutionErrorCodes.invalidPersistedState,
            metadata: Object.freeze({
              scope: this.scope,
              activeProfileId,
              validationIssues: resolved.validation.issues.map((issue) => Object.freeze({
                code: issue.code,
                path: issue.path,
                familyId: issue.familyId,
                settingKey: issue.settingKey,
                message: issue.message,
              })),
            }),
          },
        );
        await this.publishBootstrapObservability({
          event: "deployment-policy-admin.bootstrap.failed",
          occurredAt,
          outcome: DeploymentPolicyAdministrationObservabilityOutcomes.failure,
          severity: "error",
          profileId: activeProfileId,
          details: Object.freeze({
            code: error.code,
            issueCodes: Object.freeze([...new Set(error.metadata.validationIssues.map((issue) => issue.code))]),
          }),
          counters: Object.freeze({
            overrideRecordCount: overrideRecords.length,
            validationIssueCount: error.metadata.validationIssues.length,
          }),
        });
        throw error;
      }

      const evaluationContext: DeploymentPolicyEvaluationContext = Object.freeze({
        profileId: activeProfileId,
        overrideRecords: overrideRecordsForResolution,
        evaluatedAt,
      });

      const evaluationService = new DeploymentPolicyEvaluationService(
        new CanonicalDeploymentPolicySnapshotResolver({
          configurationRegistry: this.configurationRegistry,
        }),
      );
      const contextResolver: DeploymentPolicyBootstrapEvaluationContextResolver = Object.freeze({
        resolveContext: async () => evaluationContext,
      });
      await this.publishBootstrapObservability({
        event: "deployment-policy-admin.bootstrap.resolved",
        occurredAt,
        outcome: DeploymentPolicyAdministrationObservabilityOutcomes.success,
        severity: source === DeploymentPolicyBootstrapActiveProfileSourceKinds.defaultFallback ? "warn" : "info",
        profileId: activeProfileId,
        details: Object.freeze({
          activeProfileSource: source,
        }),
        counters: Object.freeze({
          overrideRecordCount: overrideRecords.length,
          familyCount: resolved.snapshot.summary.familyCount,
          settingCount: resolved.snapshot.summary.settingCount,
        }),
      });
      return Object.freeze({
        scope: this.scope,
        activeProfile: Object.freeze({
          profileId: activeProfileId,
          source,
          selectionRecord: selection,
        }),
        overrideRecords,
        evaluationContext,
        evaluationService,
        snapshot: resolved.snapshot,
        validation: resolved.validation,
        contextResolver,
      });
    } catch (error) {
      if (error instanceof DeploymentPolicyBootstrapResolutionError) {
        throw error;
      }
      await this.publishBootstrapObservability({
        event: "deployment-policy-admin.bootstrap.failed",
        occurredAt,
        outcome: DeploymentPolicyAdministrationObservabilityOutcomes.failure,
        severity: "error",
        details: Object.freeze({
          code: "bootstrap-resolution-failure",
          message: error instanceof Error ? error.message : "Unknown bootstrap failure.",
        }),
      });
      throw error;
    }
  }

  private async publishBootstrapObservability(input: {
    readonly event: string;
    readonly occurredAt: string;
    readonly outcome: "success" | "rejected" | "failure";
    readonly severity: "info" | "warn" | "error";
    readonly profileId?: string;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly counters?: Readonly<Record<string, number>>;
  }): Promise<void> {
    await publishDeploymentPolicyAdministrationObservabilityBestEffort(this.dependencies.observabilityPort, Object.freeze({
      event: input.event,
      operation: DeploymentPolicyAdministrationObservabilityOperations.bootstrap,
      outcome: input.outcome,
      severity: input.severity,
      occurredAt: input.occurredAt,
      scope: this.scope,
      profileId: input.profileId,
      details: input.details,
      counters: input.counters,
    }));
  }

  private toAdminOverrideRecord(record: DeploymentPolicyOverridePersistenceRecord): DeploymentPolicyAdminOverrideRecord {
    return Object.freeze({
      profileId: record.profileId,
      familyId: record.familyId,
      settingKey: record.settingKey,
      value: record.value,
      provenance: record.provenance,
    });
  }
}
