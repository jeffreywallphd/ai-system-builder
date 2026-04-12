import type { DeploymentPolicyResolvedSetting } from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import {
  DeploymentPolicyEvaluationSettingPaths,
  type DeploymentApprovalMode,
  type DeploymentAuditAndAdminPolicyDecision,
  type DeploymentAuthorizationPolicyDecision,
  type DeploymentPolicyEvaluatedSetting,
  type DeploymentPolicyEvaluationContext,
  type DeploymentPolicyEvaluationSettingPath,
  type DeploymentPolicySettingValueByPath,
  type DeploymentSchedulingPolicyDecision,
  type DeploymentSecurityPolicyDecision,
  type DeploymentStoragePolicyDecision,
  type DeploymentStorageTier,
  type DeploymentWorkspaceVisibility,
} from "./DeploymentPolicyEvaluationContracts";
import type {
  IDeploymentPolicyEvaluationService,
  IDeploymentPolicyEvaluationSnapshotResolverPort,
} from "./DeploymentPolicyEvaluationPorts";

interface PolicyPathParts {
  readonly familyId: string;
  readonly settingKey: string;
}

const KnownApprovalModes = new Set<DeploymentApprovalMode>([
  "self-or-owner",
  "owner-or-instructor",
  "owner-or-admin",
  "owner-with-manual-review",
]);

const KnownWorkspaceVisibilityModes = new Set<DeploymentWorkspaceVisibility>([
  "private",
  "workspace",
  "organization",
]);

const KnownStorageTiers = new Set<DeploymentStorageTier>([
  "local-managed",
  "workspace-managed",
  "server-managed",
]);

function toPolicyPathParts(path: DeploymentPolicyEvaluationSettingPath): PolicyPathParts {
  const [familyId, settingKey] = path.split(".");
  if (!familyId || !settingKey) {
    throw new DeploymentPolicyEvaluationSeamError(`Policy setting path '${path}' is invalid.`);
  }
  return Object.freeze({ familyId, settingKey });
}

export class DeploymentPolicyEvaluationSeamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeploymentPolicyEvaluationSeamError";
  }
}

export class DeploymentPolicyEvaluationService implements IDeploymentPolicyEvaluationService {
  public constructor(
    private readonly snapshotResolver: IDeploymentPolicyEvaluationSnapshotResolverPort,
  ) {}

  public async evaluateSetting<TKey extends DeploymentPolicyEvaluationSettingPath>(input: {
    readonly context: DeploymentPolicyEvaluationContext;
    readonly path: TKey;
  }): Promise<DeploymentPolicyEvaluatedSetting<DeploymentPolicySettingValueByPath[TKey]>> {
    const snapshot = await this.snapshotResolver.resolveSnapshot(input.context);
    const pathParts = toPolicyPathParts(input.path);
    const family = snapshot.families[pathParts.familyId];
    if (!family) {
      throw new DeploymentPolicyEvaluationSeamError(`Policy family '${pathParts.familyId}' was not found in effective policy snapshot.`);
    }

    const setting = family.settings[pathParts.settingKey];
    if (!setting) {
      throw new DeploymentPolicyEvaluationSeamError(
        `Policy setting '${pathParts.familyId}.${pathParts.settingKey}' was not found in effective policy snapshot.`,
      );
    }

    return this.toTypedSetting(input.path, setting);
  }

  public async evaluateAuthorizationPolicy(
    input: DeploymentPolicyEvaluationContext,
  ): Promise<DeploymentAuthorizationPolicyDecision> {
    return Object.freeze({
      defaultWorkspaceVisibility: await this.evaluateSetting({
        context: input,
        path: DeploymentPolicyEvaluationSettingPaths.sharingDefaultWorkspaceVisibility,
      }),
      publicLinkSharingAllowed: await this.evaluateSetting({
        context: input,
        path: DeploymentPolicyEvaluationSettingPaths.sharingPublicLinkAllowed,
      }),
      crossWorkspaceShareRequiresApproval: await this.evaluateSetting({
        context: input,
        path: DeploymentPolicyEvaluationSettingPaths.sharingCrossWorkspaceApprovalRequired,
      }),
      allowDelegatedWorkspaceAdmins: await this.evaluateSetting({
        context: input,
        path: DeploymentPolicyEvaluationSettingPaths.adminDelegatedWorkspaceAdminsAllowed,
      }),
    });
  }

  public async evaluateStoragePolicy(
    input: DeploymentPolicyEvaluationContext,
  ): Promise<DeploymentStoragePolicyDecision> {
    return Object.freeze({
      defaultStorageTier: await this.evaluateSetting({
        context: input,
        path: DeploymentPolicyEvaluationSettingPaths.storageDefaultTier,
      }),
      externalSyncEnabledByDefault: await this.evaluateSetting({
        context: input,
        path: DeploymentPolicyEvaluationSettingPaths.storageExternalSyncEnabledByDefault,
      }),
      retentionDaysDefault: await this.evaluateSetting({
        context: input,
        path: DeploymentPolicyEvaluationSettingPaths.storageRetentionDaysDefault,
      }),
    });
  }

  public async evaluateSchedulingPolicy(
    input: DeploymentPolicyEvaluationContext,
  ): Promise<DeploymentSchedulingPolicyDecision> {
    return Object.freeze({
      runSubmissionApprovalMode: await this.evaluateSetting({
        context: input,
        path: DeploymentPolicyEvaluationSettingPaths.approvalRunSubmissionMode,
      }),
      highRiskRunRequiresDualApproval: await this.evaluateSetting({
        context: input,
        path: DeploymentPolicyEvaluationSettingPaths.approvalHighRiskDualApproval,
      }),
      approvalEscalationTimeoutMinutes: await this.evaluateSetting({
        context: input,
        path: DeploymentPolicyEvaluationSettingPaths.approvalEscalationTimeoutMinutes,
      }),
    });
  }

  public async evaluateSecurityPolicy(
    input: DeploymentPolicyEvaluationContext,
  ): Promise<DeploymentSecurityPolicyDecision> {
    return Object.freeze({
      encryptionAtRestRequired: await this.evaluateSetting({
        context: input,
        path: DeploymentPolicyEvaluationSettingPaths.securityEncryptionAtRestRequired,
      }),
      transportTlsRequired: await this.evaluateSetting({
        context: input,
        path: DeploymentPolicyEvaluationSettingPaths.securityTransportTlsRequired,
      }),
      localCredentialRotationDays: await this.evaluateSetting({
        context: input,
        path: DeploymentPolicyEvaluationSettingPaths.securityCredentialRotationDays,
      }),
    });
  }

  public async evaluateAuditAndAdminPolicy(
    input: DeploymentPolicyEvaluationContext,
  ): Promise<DeploymentAuditAndAdminPolicyDecision> {
    return Object.freeze({
      policyChangeRequiresTicketReference: await this.evaluateSetting({
        context: input,
        path: DeploymentPolicyEvaluationSettingPaths.adminPolicyChangeRequiresTicketReference,
      }),
      policyDryRunModeEnabledByDefault: await this.evaluateSetting({
        context: input,
        path: DeploymentPolicyEvaluationSettingPaths.adminPolicyDryRunEnabledByDefault,
      }),
      auditExportEnabled: await this.evaluateSetting({
        context: input,
        path: DeploymentPolicyEvaluationSettingPaths.auditExportEnabled,
      }),
      auditRedactionStrictMode: await this.evaluateSetting({
        context: input,
        path: DeploymentPolicyEvaluationSettingPaths.auditRedactionStrictMode,
      }),
      auditRetentionDays: await this.evaluateSetting({
        context: input,
        path: DeploymentPolicyEvaluationSettingPaths.auditRetentionDays,
      }),
    });
  }

  private toTypedSetting<TKey extends DeploymentPolicyEvaluationSettingPath>(
    path: TKey,
    setting: DeploymentPolicyResolvedSetting,
  ): DeploymentPolicyEvaluatedSetting<DeploymentPolicySettingValueByPath[TKey]> {
    const value = this.assertSettingValue(path, setting.value) as DeploymentPolicySettingValueByPath[TKey];
    return Object.freeze({
      path,
      familyId: setting.familyId,
      settingKey: setting.settingKey,
      value,
      source: setting.source,
      controlMode: setting.controlMode,
    });
  }

  private assertSettingValue(path: DeploymentPolicyEvaluationSettingPath, value: unknown): unknown {
    switch (path) {
      case DeploymentPolicyEvaluationSettingPaths.approvalRunSubmissionMode:
        return assertEnum(path, value, KnownApprovalModes);
      case DeploymentPolicyEvaluationSettingPaths.sharingDefaultWorkspaceVisibility:
        return assertEnum(path, value, KnownWorkspaceVisibilityModes);
      case DeploymentPolicyEvaluationSettingPaths.storageDefaultTier:
        return assertEnum(path, value, KnownStorageTiers);
      case DeploymentPolicyEvaluationSettingPaths.approvalEscalationTimeoutMinutes:
      case DeploymentPolicyEvaluationSettingPaths.storageRetentionDaysDefault:
      case DeploymentPolicyEvaluationSettingPaths.securityCredentialRotationDays:
      case DeploymentPolicyEvaluationSettingPaths.auditRetentionDays:
        return assertNumber(path, value);
      default:
        return assertBoolean(path, value);
    }
  }
}

function assertBoolean(path: DeploymentPolicyEvaluationSettingPath, value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new DeploymentPolicyEvaluationSeamError(`Policy setting '${path}' expected boolean value.`);
  }
  return value;
}

function assertNumber(path: DeploymentPolicyEvaluationSettingPath, value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DeploymentPolicyEvaluationSeamError(`Policy setting '${path}' expected finite number value.`);
  }
  return value;
}

function assertEnum<TValue extends string>(
  path: DeploymentPolicyEvaluationSettingPath,
  value: unknown,
  allowedValues: ReadonlySet<TValue>,
): TValue {
  if (typeof value !== "string" || !allowedValues.has(value as TValue)) {
    throw new DeploymentPolicyEvaluationSeamError(
      `Policy setting '${path}' received unsupported value '${String(value)}'.`,
    );
  }
  return value as TValue;
}
