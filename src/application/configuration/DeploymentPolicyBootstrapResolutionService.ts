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
      throw new DeploymentPolicyBootstrapResolutionError(
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
