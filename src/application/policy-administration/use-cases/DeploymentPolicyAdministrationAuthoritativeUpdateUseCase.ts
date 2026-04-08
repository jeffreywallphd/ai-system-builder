
import {
  type DeploymentPolicyControlMode,
  DeploymentPolicyControlModes,
  type DeploymentPolicyFamilyCatalog,
  type DeploymentProfileId,
  createCanonicalDeploymentPolicyConfigurationRegistry,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import {
  DeploymentPolicyUpdateOperationKinds,
  DeploymentPolicyValidationIssueCodes,
  type DeploymentPolicyAdminOverrideProvenance,
  type DeploymentPolicyAdminUpdateCommand,
  type DeploymentPolicyAdministrationSnapshot,
  type DeploymentPolicyUpdateOperation,
  type DeploymentPolicyValidationIssue,
  type DeploymentPolicyValidationOutcome,
  createDeploymentPolicyValidationOutcome,
  toDeploymentPolicyValueKind,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import {
  DeploymentPolicyPersistenceScopeKinds,
  type DeploymentPolicyPersistenceScope,
  type DeploymentPolicyOverridePersistenceRecord,
  type DeploymentPolicyPersistenceMutationEnvelope,
  type DeploymentPolicyPersistenceMutationResult,
  type DeploymentPolicyActiveProfileSelectionRecord,
  type DeploymentPolicyEffectiveMetadataRecord,
} from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";
import type { IDeploymentPolicyPersistenceRepository } from "@application/deployment/ports/IDeploymentPolicyPersistenceRepository";
import {
  DeploymentPolicyEvaluationRequestLayers,
  resolveDeploymentPolicyAdministrationSnapshotWithOverrides,
} from "@application/deployment/DeploymentPolicyAdministrationContracts";
import {
  type DeploymentPolicyAdminOverrideRecord,
  validateDeploymentPolicyAdminOverrideRecords,
} from "@application/deployment/DeploymentPolicyEffectiveResolutionService";
import {
  DeploymentPolicyGovernanceEventChannels,
  DeploymentPolicyGovernanceEventTypes,
  publishDeploymentPolicyGovernanceEventBestEffort,
  type IDeploymentPolicyGovernanceEventSink,
} from "@application/policy-administration/ports/DeploymentPolicyGovernanceEventPorts";

export const DeploymentPolicyAdministrationPermissionKeys = Object.freeze({
  readState: "deployment-policy.state.read",
  selectActiveProfile: "deployment-policy.profile.select",
  manageOverrides: "deployment-policy.override.manage",
  manageRuntimeAdminOverrides: "deployment-policy.override.runtime-admin.manage",
} as const);

export type DeploymentPolicyAdministrationPermissionKey =
  typeof DeploymentPolicyAdministrationPermissionKeys[keyof typeof DeploymentPolicyAdministrationPermissionKeys];

export interface DeploymentPolicyAdministrationPermissionDecision {
  readonly allowed: boolean;
  readonly reasonCode?: string;
  readonly reason?: string;
}

export interface IDeploymentPolicyAdministrationPermissionService {
  evaluatePermission(input: {
    readonly actorUserIdentityId: string;
    readonly requiredPermission: DeploymentPolicyAdministrationPermissionKey;
    readonly scope: DeploymentPolicyPersistenceScope;
    readonly asOf?: string;
  }): Promise<DeploymentPolicyAdministrationPermissionDecision>;
}

export const DeploymentPolicyAdministrationUpdateErrorCodes = Object.freeze({
  invalidRequest: "deployment-policy-update-invalid-request",
  forbidden: "deployment-policy-update-forbidden",
  validationFailed: "deployment-policy-update-validation-failed",
  persistenceConflict: "deployment-policy-update-persistence-conflict",
} as const);

export type DeploymentPolicyAdministrationUpdateErrorCode =
  typeof DeploymentPolicyAdministrationUpdateErrorCodes[keyof typeof DeploymentPolicyAdministrationUpdateErrorCodes];

export interface DeploymentPolicyAdministrationUpdateError {
  readonly code: DeploymentPolicyAdministrationUpdateErrorCode;
  readonly message: string;
  readonly validation?: DeploymentPolicyValidationOutcome;
  readonly permission?: {
    readonly required: DeploymentPolicyAdministrationPermissionKey;
    readonly reasonCode?: string;
    readonly reason?: string;
  };
  readonly details?: Readonly<Record<string, unknown>>;
}

export type DeploymentPolicyAdministrationUpdateOutcome<TValue> =
  | {
    readonly ok: true;
    readonly value: TValue;
  }
  | {
    readonly ok: false;
    readonly error: DeploymentPolicyAdministrationUpdateError;
  };

export interface DeploymentPolicyAdministrationClock {
  now(): Date;
}

export interface DeploymentPolicyAdministrationIdGenerator {
  nextId(namespace: string): string;
}

export const DeploymentPolicyAdministrationIdNamespaces = Object.freeze({
  mutation: "deployment-policy-admin-mutation",
} as const);

class DefaultDeploymentPolicyAdministrationIdGenerator implements DeploymentPolicyAdministrationIdGenerator {
  public nextId(namespace: string): string {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return `${namespace}:${globalThis.crypto.randomUUID()}`;
    }

    return `${namespace}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
  }
}

export interface SetActiveDeploymentProfileOperation {
  readonly kind: "set-active-profile";
  readonly profileId: DeploymentProfileId;
}

export interface ApplyDeploymentPolicyOverrideOperations {
  readonly kind: "apply-override-operations";
  readonly command: DeploymentPolicyAdminUpdateCommand;
}

export type DeploymentPolicyAdministrationMutationOperation =
  | SetActiveDeploymentProfileOperation
  | ApplyDeploymentPolicyOverrideOperations;

export interface ApplyDeploymentPolicyAdministrationUpdatesInput {
  readonly scope: DeploymentPolicyPersistenceScope;
  readonly actorUserIdentityId: string;
  readonly operations: ReadonlyArray<DeploymentPolicyAdministrationMutationOperation>;
  readonly dryRun?: boolean;
  readonly occurredAt?: string;
  readonly reason?: string;
  readonly ticketReference?: string;
  readonly correlationId?: string;
  readonly expectedRevision?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface DeploymentPolicyOverrideMutationResult {
  readonly operation: DeploymentPolicyUpdateOperation;
  readonly changed: boolean;
  readonly wasReplay: boolean;
  readonly recordRevision: number;
}

export interface ApplyDeploymentPolicyAdministrationUpdatesResult {
  readonly scope: DeploymentPolicyPersistenceScope;
  readonly dryRun: boolean;
  readonly validation: DeploymentPolicyValidationOutcome;
  readonly activeProfileSelection?: DeploymentPolicyPersistenceMutationResult<DeploymentPolicyActiveProfileSelectionRecord>;
  readonly overrideMutations: ReadonlyArray<DeploymentPolicyOverrideMutationResult>;
  readonly effectiveMetadata?: DeploymentPolicyPersistenceMutationResult<DeploymentPolicyEffectiveMetadataRecord>;
  readonly snapshot: DeploymentPolicyAdministrationSnapshot;
}

export interface DeploymentPolicyAdministrationAuthoritativeUpdateUseCaseDependencies {
  readonly deploymentPolicyRepository: IDeploymentPolicyPersistenceRepository;
  readonly permissionService: IDeploymentPolicyAdministrationPermissionService;
  readonly governanceEventSink?: IDeploymentPolicyGovernanceEventSink;
  readonly familyCatalog?: DeploymentPolicyFamilyCatalog;
  readonly presetCatalog?: ReturnType<typeof createCanonicalDeploymentPolicyConfigurationRegistry>["presetCatalog"];
  readonly clock?: DeploymentPolicyAdministrationClock;
  readonly idGenerator?: DeploymentPolicyAdministrationIdGenerator;
}

interface LoadedScopeState {
  readonly activeProfileSelection?: DeploymentPolicyActiveProfileSelectionRecord;
  readonly overridesByProfile: Readonly<Record<DeploymentProfileId, ReadonlyArray<DeploymentPolicyOverridePersistenceRecord>>>;
}

interface PolicyOverrideSafeSummary {
  readonly familyId: string;
  readonly settingKey: string;
  readonly operation: DeploymentPolicyUpdateOperation["operation"];
  readonly changed: boolean;
  readonly wasReplay: boolean;
  readonly before: Readonly<{
    readonly existed: boolean;
    readonly valueType?: string;
    readonly revision?: number;
  }>;
  readonly after: Readonly<{
    readonly existed: boolean;
    readonly valueType?: string;
    readonly revision?: number;
  }>;
}

function toFailure<TValue>(
  code: DeploymentPolicyAdministrationUpdateErrorCode,
  message: string,
  options: {
    readonly validation?: DeploymentPolicyValidationOutcome;
    readonly permission?: {
      readonly required: DeploymentPolicyAdministrationPermissionKey;
      readonly reasonCode?: string;
      readonly reason?: string;
    };
    readonly details?: Readonly<Record<string, unknown>>;
  } = {},
): DeploymentPolicyAdministrationUpdateOutcome<TValue> {
  return {
    ok: false,
    error: Object.freeze({
      code,
      message,
      validation: options.validation,
      permission: options.permission,
      details: options.details,
    }),
  };
}

function normalizeScope(scope: DeploymentPolicyPersistenceScope): DeploymentPolicyPersistenceScope {
  return Object.freeze({
    kind: scope.kind,
    scopeId: scope.scopeId.trim().toLowerCase(),
  });
}

function normalizeOptionalString(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function toOverrideRecord(
  profileId: DeploymentProfileId,
  operation: DeploymentPolicyUpdateOperation,
): DeploymentPolicyAdminOverrideRecord {
  return Object.freeze({
    profileId,
    familyId: operation.familyId,
    settingKey: operation.settingKey,
    value: operation.value!,
    provenance: operation.provenance,
  });
}

function toValidationIssue(input: {
  readonly code: DeploymentPolicyValidationIssue["code"];
  readonly path: string;
  readonly message: string;
  readonly familyId?: string;
  readonly settingKey?: string;
  readonly expectedType?: DeploymentPolicyValidationIssue["expectedType"];
  readonly receivedType?: string;
}): DeploymentPolicyValidationIssue {
  return Object.freeze({
    code: input.code,
    path: input.path,
    message: input.message,
    familyId: input.familyId,
    settingKey: input.settingKey,
    expectedType: input.expectedType,
    receivedType: input.receivedType,
  });
}

function mergeIssues(
  first: ReadonlyArray<DeploymentPolicyValidationIssue>,
  second: ReadonlyArray<DeploymentPolicyValidationIssue>,
): ReadonlyArray<DeploymentPolicyValidationIssue> {
  return Object.freeze([...first, ...second]);
}

export class DeploymentPolicyAdministrationAuthoritativeUpdateUseCase {
  private readonly familyCatalog: DeploymentPolicyFamilyCatalog;
  private readonly presetCatalog: ReturnType<typeof createCanonicalDeploymentPolicyConfigurationRegistry>["presetCatalog"];
  private readonly clock: DeploymentPolicyAdministrationClock;
  private readonly idGenerator: DeploymentPolicyAdministrationIdGenerator;

  public constructor(private readonly dependencies: DeploymentPolicyAdministrationAuthoritativeUpdateUseCaseDependencies) {
    const registry = createCanonicalDeploymentPolicyConfigurationRegistry();
    this.familyCatalog = dependencies.familyCatalog ?? registry.familyCatalog;
    this.presetCatalog = dependencies.presetCatalog ?? registry.presetCatalog;
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
    this.idGenerator = dependencies.idGenerator ?? new DefaultDeploymentPolicyAdministrationIdGenerator();
  }

  public async execute(
    input: ApplyDeploymentPolicyAdministrationUpdatesInput,
  ): Promise<DeploymentPolicyAdministrationUpdateOutcome<ApplyDeploymentPolicyAdministrationUpdatesResult>> {
    const scope = normalizeScope(input.scope);
    if (scope.kind !== DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope) {
      return toFailure(
        DeploymentPolicyAdministrationUpdateErrorCodes.invalidRequest,
        `Unsupported deployment-policy scope kind '${scope.kind}'.`,
        {
          validation: createDeploymentPolicyValidationOutcome({
            issues: [toValidationIssue({
              code: DeploymentPolicyValidationIssueCodes.invalidUpdateOperation,
              path: "scope.kind",
              message: `Only '${DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope}' is supported for policy-administration mutations.`,
            })],
            evaluatedAt: this.clock.now().toISOString(),
          }),
        },
      );
    }

    if (input.operations.length < 1) {
      return toFailure(
        DeploymentPolicyAdministrationUpdateErrorCodes.invalidRequest,
        "At least one deployment-policy administration operation is required.",
      );
    }

    const loaded = await this.loadScopeState(scope, input.operations);
    let workingOverridesByProfile = { ...loaded.overridesByProfile };
    let currentActiveProfileSelection = loaded.activeProfileSelection;

    let validationIssues: ReadonlyArray<DeploymentPolicyValidationIssue> = Object.freeze([]);
    const overrideMutations: DeploymentPolicyOverrideMutationResult[] = [];
    const overrideSafeSummaries: PolicyOverrideSafeSummary[] = [];
    let activeProfileSelectionMutation: DeploymentPolicyPersistenceMutationResult<DeploymentPolicyActiveProfileSelectionRecord>
      | undefined;

    for (const operation of input.operations) {
      if (operation.kind === "set-active-profile") {
        const previousActiveProfileId = currentActiveProfileSelection?.profileId;
        const permission = await this.dependencies.permissionService.evaluatePermission({
          actorUserIdentityId: input.actorUserIdentityId,
          requiredPermission: DeploymentPolicyAdministrationPermissionKeys.selectActiveProfile,
          scope,
          asOf: input.occurredAt,
        });

        if (!permission.allowed) {
          return toFailure(
            DeploymentPolicyAdministrationUpdateErrorCodes.forbidden,
            "Actor is not authorized to change the active deployment profile.",
            {
              permission: {
                required: DeploymentPolicyAdministrationPermissionKeys.selectActiveProfile,
                reasonCode: permission.reasonCode,
                reason: permission.reason,
              },
            },
          );
        }

        const nowIso = input.occurredAt ?? this.clock.now().toISOString();
        const nextRecord: DeploymentPolicyActiveProfileSelectionRecord = Object.freeze({
          scope,
          profileId: operation.profileId,
          changedAt: nowIso,
          changedByUserIdentityId: input.actorUserIdentityId,
          reason: normalizeOptionalString(input.reason),
          ticketReference: normalizeOptionalString(input.ticketReference),
          createdAt: currentActiveProfileSelection?.createdAt ?? nowIso,
          createdBy: currentActiveProfileSelection?.createdBy ?? input.actorUserIdentityId,
          lastModifiedAt: nowIso,
          lastModifiedBy: input.actorUserIdentityId,
          revision: currentActiveProfileSelection?.revision ?? 0,
        });

        if (!input.dryRun) {
          try {
            activeProfileSelectionMutation = await this.dependencies.deploymentPolicyRepository.setActiveProfileSelection({
              record: nextRecord,
              mutation: this.createMutationEnvelope({
                actorUserIdentityId: input.actorUserIdentityId,
                operationPrefix: "set-active-profile",
                occurredAt: input.occurredAt,
                reason: input.reason,
                ticketReference: input.ticketReference,
                correlationId: input.correlationId,
                metadata: input.metadata,
                expectedRevision: input.expectedRevision,
              }),
            });
            currentActiveProfileSelection = activeProfileSelectionMutation.record;
          } catch (error) {
            return toFailure(
              DeploymentPolicyAdministrationUpdateErrorCodes.persistenceConflict,
              `Failed to persist active profile selection: ${error instanceof Error ? error.message : "Unknown persistence error."}`,
            );
          }

          await this.publishGovernanceEventPair({
            type: DeploymentPolicyGovernanceEventTypes.activeProfileChanged,
            occurredAt: currentActiveProfileSelection.changedAt,
            actorUserIdentityId: input.actorUserIdentityId,
            scope,
            profileId: currentActiveProfileSelection.profileId,
            details: Object.freeze({
              reason: normalizeOptionalString(input.reason),
              ticketReference: normalizeOptionalString(input.ticketReference),
              previousProfileId: previousActiveProfileId,
              nextProfileId: currentActiveProfileSelection.profileId,
              revision: currentActiveProfileSelection.revision,
              changed: activeProfileSelectionMutation.changed,
              wasReplay: activeProfileSelectionMutation.wasReplay,
            }),
            correlationId: input.correlationId,
          });
        } else {
          currentActiveProfileSelection = nextRecord;
        }

        continue;
      }

      const command = operation.command;
      const overridePermission = await this.dependencies.permissionService.evaluatePermission({
        actorUserIdentityId: input.actorUserIdentityId,
        requiredPermission: DeploymentPolicyAdministrationPermissionKeys.manageOverrides,
        scope,
        asOf: input.occurredAt,
      });

      if (!overridePermission.allowed) {
        return toFailure(
          DeploymentPolicyAdministrationUpdateErrorCodes.forbidden,
          "Actor is not authorized to update deployment policy overrides.",
          {
            permission: {
              required: DeploymentPolicyAdministrationPermissionKeys.manageOverrides,
              reasonCode: overridePermission.reasonCode,
              reason: overridePermission.reason,
            },
          },
        );
      }

      const commandValidation = this.validateUpdateCommandShape(command);
      validationIssues = mergeIssues(validationIssues, commandValidation);
      if (commandValidation.length > 0) {
        continue;
      }

      const existingForProfile = [...(workingOverridesByProfile[command.profileId] ?? [])];
      const operationValidation = await this.validateOverrideOperations({
        command,
        existingOverrides: existingForProfile,
        actorUserIdentityId: input.actorUserIdentityId,
        scope,
        ticketReference: input.ticketReference,
      });
      validationIssues = mergeIssues(validationIssues, operationValidation.issues);
      if (operationValidation.issues.length > 0) {
        continue;
      }

      if (operationValidation.requiresRuntimePermission) {
        const runtimePermission = await this.dependencies.permissionService.evaluatePermission({
          actorUserIdentityId: input.actorUserIdentityId,
          requiredPermission: DeploymentPolicyAdministrationPermissionKeys.manageRuntimeAdminOverrides,
          scope,
          asOf: input.occurredAt,
        });
        if (!runtimePermission.allowed) {
          return toFailure(
            DeploymentPolicyAdministrationUpdateErrorCodes.forbidden,
            "Actor is not authorized to mutate runtime-admin deployment policy settings.",
            {
              permission: {
                required: DeploymentPolicyAdministrationPermissionKeys.manageRuntimeAdminOverrides,
                reasonCode: runtimePermission.reasonCode,
                reason: runtimePermission.reason,
              },
            },
          );
        }
      }

      if (!input.dryRun) {
        for (const item of operationValidation.appliedOperations) {
          const previousRecord = item.existingIndex !== undefined
            ? existingForProfile[item.existingIndex]
            : undefined;
          const mutation = this.createMutationEnvelope({
            actorUserIdentityId: input.actorUserIdentityId,
            operationPrefix: `override-${item.operation.operation}`,
            occurredAt: command.submittedAt ?? input.occurredAt,
            reason: input.reason,
            ticketReference: input.ticketReference,
            correlationId: input.correlationId,
            metadata: input.metadata,
            expectedRevision: command.expectedRevision,
          });

          try {
            if (item.operation.operation === DeploymentPolicyUpdateOperationKinds.upsert) {
              const nowIso = command.submittedAt ?? input.occurredAt ?? this.clock.now().toISOString();
              const result = await this.dependencies.deploymentPolicyRepository.upsertOverrideRecord({
                record: Object.freeze({
                  scope,
                  profileId: command.profileId,
                  familyId: item.operation.familyId,
                  settingKey: item.operation.settingKey,
                  value: item.operation.value!,
                  valueType: toDeploymentPolicyValueKind(item.operation.value!),
                  provenance: this.toPersistedProvenance({
                    operationProvenance: item.operation.provenance,
                    actorUserIdentityId: input.actorUserIdentityId,
                    occurredAt: command.submittedAt ?? input.occurredAt,
                    reason: input.reason,
                    ticketReference: input.ticketReference,
                  }),
                  createdAt: nowIso,
                  createdBy: input.actorUserIdentityId,
                  lastModifiedAt: nowIso,
                  lastModifiedBy: input.actorUserIdentityId,
                  revision: 0,
                }),
                mutation,
              });

              if (item.existingIndex === undefined) {
                existingForProfile.push(result.record);
              } else {
                existingForProfile.splice(item.existingIndex, 1, result.record);
              }
              overrideSafeSummaries.push(this.toOverrideSafeSummary({
                operation: item.operation,
                changed: result.changed,
                wasReplay: result.wasReplay,
                beforeRecord: previousRecord,
                afterRecord: result.record,
              }));

              overrideMutations.push(Object.freeze({
                operation: item.operation,
                changed: result.changed,
                wasReplay: result.wasReplay,
                recordRevision: result.record.revision,
              }));
              continue;
            }

            const result = await this.dependencies.deploymentPolicyRepository.removeOverrideRecord({
              scope,
              profileId: command.profileId,
              familyId: item.operation.familyId,
              settingKey: item.operation.settingKey,
              mutation,
            });

            if (item.existingIndex !== undefined) {
              existingForProfile.splice(item.existingIndex, 1);
            }
            overrideSafeSummaries.push(this.toOverrideSafeSummary({
              operation: item.operation,
              changed: result.changed,
              wasReplay: result.wasReplay,
              beforeRecord: previousRecord,
              afterRecord: undefined,
            }));
            overrideMutations.push(Object.freeze({
              operation: item.operation,
              changed: result.changed,
              wasReplay: result.wasReplay,
              recordRevision: result.record.revision,
            }));
          } catch (error) {
            return toFailure(
              DeploymentPolicyAdministrationUpdateErrorCodes.persistenceConflict,
              `Failed to persist deployment-policy override operation '${item.operation.operation}' for '${item.operation.familyId}.${item.operation.settingKey}': ${error instanceof Error ? error.message : "Unknown persistence error."}`,
            );
          }
        }
      } else {
        for (const item of operationValidation.appliedOperations) {
          const previousRecord = item.existingIndex !== undefined
            ? existingForProfile[item.existingIndex]
            : undefined;
          if (item.operation.operation === DeploymentPolicyUpdateOperationKinds.upsert) {
            const nowIso = command.submittedAt ?? input.occurredAt ?? this.clock.now().toISOString();
            const simulated = Object.freeze({
              scope,
              profileId: command.profileId,
              familyId: item.operation.familyId,
              settingKey: item.operation.settingKey,
              value: item.operation.value!,
              valueType: toDeploymentPolicyValueKind(item.operation.value!),
              provenance: this.toPersistedProvenance({
                operationProvenance: item.operation.provenance,
                actorUserIdentityId: input.actorUserIdentityId,
                occurredAt: command.submittedAt ?? input.occurredAt,
                reason: input.reason,
                ticketReference: input.ticketReference,
              }),
              createdAt: nowIso,
              createdBy: input.actorUserIdentityId,
              lastModifiedAt: nowIso,
              lastModifiedBy: input.actorUserIdentityId,
              revision: item.existingRevision ? item.existingRevision + 1 : 1,
            } satisfies DeploymentPolicyOverridePersistenceRecord);

            if (item.existingIndex === undefined) {
              existingForProfile.push(simulated);
            } else {
              existingForProfile.splice(item.existingIndex, 1, simulated);
            }
            overrideSafeSummaries.push(this.toOverrideSafeSummary({
              operation: item.operation,
              changed: true,
              wasReplay: false,
              beforeRecord: previousRecord,
              afterRecord: simulated,
            }));

            overrideMutations.push(Object.freeze({
              operation: item.operation,
              changed: true,
              wasReplay: false,
              recordRevision: simulated.revision,
            }));
            continue;
          }

          if (item.existingIndex !== undefined) {
            const previous = existingForProfile[item.existingIndex];
            existingForProfile.splice(item.existingIndex, 1);
            overrideSafeSummaries.push(this.toOverrideSafeSummary({
              operation: item.operation,
              changed: true,
              wasReplay: false,
              beforeRecord: previousRecord,
              afterRecord: undefined,
            }));
            overrideMutations.push(Object.freeze({
              operation: item.operation,
              changed: true,
              wasReplay: false,
              recordRevision: (previous?.revision ?? 0) + 1,
            }));
          }
        }
      }

      workingOverridesByProfile = {
        ...workingOverridesByProfile,
        [command.profileId]: Object.freeze(existingForProfile),
      };
    }

    const validation = createDeploymentPolicyValidationOutcome({
      issues: validationIssues,
      evaluatedAt: this.clock.now().toISOString(),
    });

    if (!validation.valid) {
      return toFailure(
        DeploymentPolicyAdministrationUpdateErrorCodes.validationFailed,
        "Deployment-policy mutation request failed validation.",
        {
          validation,
        },
      );
    }

    const snapshotProfileId = this.resolveSnapshotProfileId({
      activeProfileSelection: currentActiveProfileSelection,
      operations: input.operations,
    });

    const overrideRecordsForSnapshot = (workingOverridesByProfile[snapshotProfileId] ?? []).map((record) =>
      this.toAdminOverrideRecord(record));

    const resolved = resolveDeploymentPolicyAdministrationSnapshotWithOverrides({
      profileId: snapshotProfileId,
      familyCatalog: this.familyCatalog,
      presetCatalog: this.presetCatalog,
      overrideRecords: overrideRecordsForSnapshot,
      evaluationLayer: DeploymentPolicyEvaluationRequestLayers.application,
      evaluatedAt: this.clock.now().toISOString(),
    });

    let effectiveMetadataMutation: DeploymentPolicyPersistenceMutationResult<DeploymentPolicyEffectiveMetadataRecord> | undefined;
    if (!input.dryRun) {
      try {
        effectiveMetadataMutation = await this.dependencies.deploymentPolicyRepository.saveEffectivePolicyMetadata({
          record: Object.freeze({
            scope,
            profileId: snapshotProfileId,
            evaluatedAt: resolved.snapshot.evaluatedAt,
            evaluationLayer: resolved.snapshot.evaluationLayer,
            contractVersion: resolved.snapshot.contractVersion,
            familyCount: resolved.snapshot.summary.familyCount,
            settingCount: resolved.snapshot.summary.settingCount,
            sourceCounts: resolved.snapshot.summary.sourceCounts,
            validation: resolved.validation,
            recordedAt: this.clock.now().toISOString(),
            recordedByUserIdentityId: input.actorUserIdentityId,
            revision: 0,
          }),
          mutation: this.createMutationEnvelope({
            actorUserIdentityId: input.actorUserIdentityId,
            operationPrefix: "save-effective-metadata",
            occurredAt: input.occurredAt,
            reason: input.reason,
            ticketReference: input.ticketReference,
            correlationId: input.correlationId,
            metadata: input.metadata,
          }),
        });
      } catch (error) {
        return toFailure(
          DeploymentPolicyAdministrationUpdateErrorCodes.persistenceConflict,
          `Failed to persist effective deployment-policy metadata: ${error instanceof Error ? error.message : "Unknown persistence error."}`,
        );
      }
    }

    if (!input.dryRun && overrideSafeSummaries.length > 0) {
      await this.publishGovernanceEventPair({
        type: DeploymentPolicyGovernanceEventTypes.overridesMutated,
        occurredAt: input.occurredAt ?? this.clock.now().toISOString(),
        actorUserIdentityId: input.actorUserIdentityId,
        scope,
        profileId: snapshotProfileId,
        policyFamilyIds: Object.freeze([...new Set(overrideSafeSummaries.map((item) => item.familyId))]),
        details: Object.freeze({
          reason: normalizeOptionalString(input.reason),
          ticketReference: normalizeOptionalString(input.ticketReference),
          mutationCount: overrideSafeSummaries.length,
          mutations: Object.freeze(overrideSafeSummaries),
        }),
        correlationId: input.correlationId,
      });
    }

    return {
      ok: true,
      value: Object.freeze({
        scope,
        dryRun: input.dryRun ?? false,
        validation,
        activeProfileSelection: activeProfileSelectionMutation,
        overrideMutations: Object.freeze(overrideMutations),
        effectiveMetadata: effectiveMetadataMutation,
        snapshot: resolved.snapshot,
      }),
    };
  }

  private async loadScopeState(
    scope: DeploymentPolicyPersistenceScope,
    operations: ReadonlyArray<DeploymentPolicyAdministrationMutationOperation>,
  ): Promise<LoadedScopeState> {
    const activeProfileSelection = await this.dependencies.deploymentPolicyRepository.getActiveProfileSelection(scope);
    const profiles = new Set<DeploymentProfileId>();

    for (const operation of operations) {
      if (operation.kind === "set-active-profile") {
        profiles.add(operation.profileId);
        continue;
      }
      profiles.add(operation.command.profileId);
    }

    const overridesByProfile: Partial<Record<DeploymentProfileId, ReadonlyArray<DeploymentPolicyOverridePersistenceRecord>>> = {};
    for (const profileId of profiles) {
      overridesByProfile[profileId] = await this.dependencies.deploymentPolicyRepository.listOverrideRecords({
        scope,
        profileId,
      });
    }

    return Object.freeze({
      activeProfileSelection,
      overridesByProfile: Object.freeze(overridesByProfile as Record<DeploymentProfileId, ReadonlyArray<DeploymentPolicyOverridePersistenceRecord>>),
    });
  }

  private validateUpdateCommandShape(
    command: DeploymentPolicyAdminUpdateCommand,
  ): ReadonlyArray<DeploymentPolicyValidationIssue> {
    const issues: DeploymentPolicyValidationIssue[] = [];

    if (command.operations.length < 1) {
      issues.push(toValidationIssue({
        code: DeploymentPolicyValidationIssueCodes.invalidUpdateOperation,
        path: "command.operations",
        message: "At least one deployment-policy override operation is required.",
      }));
    }

    if (command.expectedRevision !== undefined && command.operations.length > 1) {
      issues.push(toValidationIssue({
        code: DeploymentPolicyValidationIssueCodes.invalidUpdateOperation,
        path: "command.expectedRevision",
        message: "expectedRevision is only supported when exactly one override operation is submitted.",
      }));
    }

    for (const [index, operation] of command.operations.entries()) {
      const path = `command.operations[${index}]`;
      if (operation.operation === DeploymentPolicyUpdateOperationKinds.upsert) {
        if (operation.value === undefined) {
          issues.push(toValidationIssue({
            code: DeploymentPolicyValidationIssueCodes.invalidUpdateOperation,
            path: `${path}.value`,
            familyId: operation.familyId,
            settingKey: operation.settingKey,
            message: "upsert operations require a value.",
          }));
        }

        if (operation.valueType && operation.value !== undefined && typeof operation.value !== operation.valueType) {
          issues.push(toValidationIssue({
            code: DeploymentPolicyValidationIssueCodes.invalidUpdateOperation,
            path: `${path}.valueType`,
            familyId: operation.familyId,
            settingKey: operation.settingKey,
            expectedType: operation.valueType,
            receivedType: typeof operation.value,
            message: `valueType '${operation.valueType}' does not match provided value type '${typeof operation.value}'.`,
          }));
        }
      }

      if (operation.operation === DeploymentPolicyUpdateOperationKinds.remove && operation.value !== undefined) {
        issues.push(toValidationIssue({
          code: DeploymentPolicyValidationIssueCodes.invalidUpdateOperation,
          path: `${path}.value`,
          familyId: operation.familyId,
          settingKey: operation.settingKey,
          message: "remove operations cannot include a value.",
        }));
      }
    }

    return Object.freeze(issues);
  }

  private async validateOverrideOperations(input: {
    readonly command: DeploymentPolicyAdminUpdateCommand;
    readonly existingOverrides: ReadonlyArray<DeploymentPolicyOverridePersistenceRecord>;
    readonly actorUserIdentityId: string;
    readonly scope: DeploymentPolicyPersistenceScope;
    readonly ticketReference?: string;
  }): Promise<{
    readonly issues: ReadonlyArray<DeploymentPolicyValidationIssue>;
    readonly requiresRuntimePermission: boolean;
    readonly appliedOperations: ReadonlyArray<{
      readonly operation: DeploymentPolicyUpdateOperation;
      readonly existingIndex?: number;
      readonly existingRevision?: number;
    }>;
  }> {
    const issues: DeploymentPolicyValidationIssue[] = [];
    const appliedOperations: Array<{
      readonly operation: DeploymentPolicyUpdateOperation;
      readonly existingIndex?: number;
      readonly existingRevision?: number;
    }> = [];

    const working = [...input.existingOverrides];
    let requiresRuntimePermission = false;

    for (const [index, operation] of input.command.operations.entries()) {
      const operationPath = `command.operations[${index}]`;
      const settingDefinition = this.resolveSettingDefinition(operation.familyId, operation.settingKey);
      if (!settingDefinition) {
        const familyExists = !!this.familyCatalog[operation.familyId];
        issues.push(toValidationIssue({
          code: familyExists
            ? DeploymentPolicyValidationIssueCodes.unknownSetting
            : DeploymentPolicyValidationIssueCodes.unknownFamily,
          path: familyExists ? `${operationPath}.settingKey` : `${operationPath}.familyId`,
          familyId: operation.familyId,
          settingKey: operation.settingKey,
          message: familyExists
            ? `Policy setting '${operation.familyId}.${operation.settingKey}' is not defined in the deployment policy catalog.`
            : `Policy family '${operation.familyId}' is not defined in the deployment policy catalog.`,
        }));
        continue;
      }

      if (settingDefinition.controlMode === DeploymentPolicyControlModes.runtimeAdmin) {
        requiresRuntimePermission = true;
      }

      if (operation.expectedControlMode && operation.expectedControlMode !== settingDefinition.controlMode) {
        issues.push(toValidationIssue({
          code: DeploymentPolicyValidationIssueCodes.invalidUpdateOperation,
          path: `${operationPath}.expectedControlMode`,
          familyId: operation.familyId,
          settingKey: operation.settingKey,
          message:
            `Expected control mode '${operation.expectedControlMode}' does not match canonical control mode '${settingDefinition.controlMode}'.`,
        }));
        continue;
      }

      const existingIndex = working.findIndex((entry) => (
        entry.familyId === operation.familyId && entry.settingKey === operation.settingKey
      ));

      if (operation.operation === DeploymentPolicyUpdateOperationKinds.remove) {
        if (existingIndex < 0) {
          issues.push(toValidationIssue({
            code: DeploymentPolicyValidationIssueCodes.invalidUpdateOperation,
            path: `${operationPath}.operation`,
            familyId: operation.familyId,
            settingKey: operation.settingKey,
            message:
              `Cannot remove deployment-policy override '${operation.familyId}.${operation.settingKey}' because no override exists for profile '${input.command.profileId}'.`,
          }));
          continue;
        }

        working.splice(existingIndex, 1);
        appliedOperations.push(Object.freeze({
          operation,
          existingIndex,
          existingRevision: input.existingOverrides[existingIndex]?.revision,
        }));
        continue;
      }

      const upsertRecord = toOverrideRecord(input.command.profileId, operation);
      const upsertValidation = validateDeploymentPolicyAdminOverrideRecords({
        profileId: input.command.profileId,
        familyCatalog: this.familyCatalog,
        overrideRecords: [upsertRecord],
        evaluatedAt: this.clock.now().toISOString(),
      });

      if (!upsertValidation.validation.valid) {
        issues.push(...upsertValidation.validation.issues.map((issue) => Object.freeze({
          ...issue,
          path: issue.path.replace(/^overrideRecords\[0\]/, operationPath),
        })));
        continue;
      }

      const persistedRecord: DeploymentPolicyOverridePersistenceRecord = Object.freeze({
        scope: input.scope,
        profileId: input.command.profileId,
        familyId: operation.familyId,
        settingKey: operation.settingKey,
        value: operation.value!,
        valueType: toDeploymentPolicyValueKind(operation.value!),
        provenance: this.toPersistedProvenance({
          operationProvenance: operation.provenance,
          actorUserIdentityId: input.actorUserIdentityId,
          occurredAt: input.command.submittedAt,
          ticketReference: input.ticketReference,
        }),
        createdAt: input.command.submittedAt ?? this.clock.now().toISOString(),
        createdBy: input.actorUserIdentityId,
        lastModifiedAt: input.command.submittedAt ?? this.clock.now().toISOString(),
        lastModifiedBy: input.actorUserIdentityId,
        revision: existingIndex >= 0 ? (working[existingIndex]?.revision ?? 0) + 1 : 1,
      });

      if (existingIndex >= 0) {
        working.splice(existingIndex, 1, persistedRecord);
      } else {
        working.push(persistedRecord);
      }

      appliedOperations.push(Object.freeze({
        operation,
        existingIndex: existingIndex >= 0 ? existingIndex : undefined,
        existingRevision: existingIndex >= 0 ? input.existingOverrides[existingIndex]?.revision : undefined,
      }));
    }

    const ticketReferenceRequired = this.isTicketReferenceRequired({
      profileId: input.command.profileId,
      overrideRecords: working.map((record) => this.toAdminOverrideRecord(record)),
    });

    const requestedTicketReference = normalizeOptionalString(
      input.ticketReference
      ?? input.command.operations.find((operation) => operation.provenance?.ticketReference)?.provenance?.ticketReference,
    );

    if (ticketReferenceRequired && !requestedTicketReference) {
      issues.push(toValidationIssue({
        code: DeploymentPolicyValidationIssueCodes.invalidUpdateOperation,
        path: "mutation.context.ticketReference",
        message:
          "Policy changes require a ticketReference for the selected profile and scope. Provide ticketReference in operation provenance or mutation context.",
      }));
    }

    return Object.freeze({
      issues: Object.freeze(issues),
      requiresRuntimePermission,
      appliedOperations: Object.freeze(appliedOperations),
    });
  }

  private isTicketReferenceRequired(input: {
    readonly profileId: DeploymentProfileId;
    readonly overrideRecords: ReadonlyArray<DeploymentPolicyAdminOverrideRecord>;
  }): boolean {
    const resolved = resolveDeploymentPolicyAdministrationSnapshotWithOverrides({
      profileId: input.profileId,
      familyCatalog: this.familyCatalog,
      presetCatalog: this.presetCatalog,
      overrideRecords: input.overrideRecords,
      evaluationLayer: DeploymentPolicyEvaluationRequestLayers.application,
      evaluatedAt: this.clock.now().toISOString(),
    });

    const value = resolved.snapshot.families["admin-controls"]?.settings.policyChangeRequiresTicketReference?.value;
    return typeof value === "boolean" ? value : true;
  }

  private resolveSettingDefinition(
    familyId: string,
    settingKey: string,
  ): { readonly controlMode: DeploymentPolicyControlMode } | undefined {
    const family = this.familyCatalog[familyId];
    return family?.settings.find((entry) => entry.settingKey === settingKey);
  }

  private createMutationEnvelope(input: {
    readonly actorUserIdentityId: string;
    readonly operationPrefix: string;
    readonly occurredAt?: string;
    readonly reason?: string;
    readonly ticketReference?: string;
    readonly correlationId?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly expectedRevision?: number;
  }): DeploymentPolicyPersistenceMutationEnvelope {
    return Object.freeze({
      operationKey: `${input.operationPrefix}:${this.idGenerator.nextId(DeploymentPolicyAdministrationIdNamespaces.mutation)}`,
      expectedRevision: input.expectedRevision,
      context: Object.freeze({
        actorUserIdentityId: input.actorUserIdentityId,
        occurredAt: input.occurredAt,
        reason: normalizeOptionalString(input.reason),
        ticketReference: normalizeOptionalString(input.ticketReference),
        correlationId: normalizeOptionalString(input.correlationId),
        metadata: input.metadata,
      }),
    });
  }

  private async publishGovernanceEventPair(input: {
    readonly type: typeof DeploymentPolicyGovernanceEventTypes[keyof typeof DeploymentPolicyGovernanceEventTypes];
    readonly occurredAt: string;
    readonly actorUserIdentityId: string;
    readonly scope: DeploymentPolicyPersistenceScope;
    readonly profileId?: string;
    readonly policyFamilyIds?: ReadonlyArray<string>;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly correlationId?: string;
  }): Promise<void> {
    const scopeKind = input.scope.scopeId === "system"
      ? "system"
      : "workspace";

    await publishDeploymentPolicyGovernanceEventBestEffort(this.dependencies.governanceEventSink, {
      channel: DeploymentPolicyGovernanceEventChannels.audit,
      type: input.type,
      occurredAt: input.occurredAt,
      outcome: "succeeded",
      actorUserIdentityId: input.actorUserIdentityId,
      scopeKind,
      scopeId: input.scope.scopeId,
      profileId: input.profileId,
      policyFamilyIds: input.policyFamilyIds,
      correlationId: input.correlationId,
      details: input.details,
    });

    await publishDeploymentPolicyGovernanceEventBestEffort(this.dependencies.governanceEventSink, {
      channel: DeploymentPolicyGovernanceEventChannels.operational,
      type: input.type,
      occurredAt: input.occurredAt,
      outcome: "succeeded",
      actorUserIdentityId: input.actorUserIdentityId,
      scopeKind,
      scopeId: input.scope.scopeId,
      profileId: input.profileId,
      policyFamilyIds: input.policyFamilyIds,
      correlationId: input.correlationId,
      details: input.details,
    });
  }

  private toOverrideSafeSummary(input: {
    readonly operation: DeploymentPolicyUpdateOperation;
    readonly changed: boolean;
    readonly wasReplay: boolean;
    readonly beforeRecord?: DeploymentPolicyOverridePersistenceRecord;
    readonly afterRecord?: DeploymentPolicyOverridePersistenceRecord;
  }): PolicyOverrideSafeSummary {
    return Object.freeze({
      familyId: input.operation.familyId,
      settingKey: input.operation.settingKey,
      operation: input.operation.operation,
      changed: input.changed,
      wasReplay: input.wasReplay,
      before: this.toSafeOverrideState(input.beforeRecord),
      after: this.toSafeOverrideState(input.afterRecord),
    });
  }

  private toSafeOverrideState(record?: DeploymentPolicyOverridePersistenceRecord): PolicyOverrideSafeSummary["before"] {
    if (!record) {
      return Object.freeze({
        existed: false,
      });
    }

    return Object.freeze({
      existed: true,
      valueType: record.valueType,
      revision: record.revision,
    });
  }

  private toPersistedProvenance(input: {
    readonly operationProvenance?: DeploymentPolicyAdminOverrideProvenance;
    readonly actorUserIdentityId: string;
    readonly occurredAt?: string;
    readonly reason?: string;
    readonly ticketReference?: string;
  }): DeploymentPolicyAdminOverrideProvenance {
    return Object.freeze({
      actorUserIdentityId: input.operationProvenance?.actorUserIdentityId ?? input.actorUserIdentityId,
      reason: normalizeOptionalString(input.operationProvenance?.reason ?? input.reason),
      ticketReference: normalizeOptionalString(input.operationProvenance?.ticketReference ?? input.ticketReference),
      updatedAt: input.operationProvenance?.updatedAt ?? input.occurredAt ?? this.clock.now().toISOString(),
    });
  }

  private resolveSnapshotProfileId(input: {
    readonly activeProfileSelection?: DeploymentPolicyActiveProfileSelectionRecord;
    readonly operations: ReadonlyArray<DeploymentPolicyAdministrationMutationOperation>;
  }): DeploymentProfileId {
    const overrideProfile = [...input.operations]
      .reverse()
      .find((operation) => operation.kind === "apply-override-operations") as ApplyDeploymentPolicyOverrideOperations | undefined;

    if (overrideProfile) {
      return overrideProfile.command.profileId;
    }

    if (input.activeProfileSelection) {
      return input.activeProfileSelection.profileId;
    }

    return "home";
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
