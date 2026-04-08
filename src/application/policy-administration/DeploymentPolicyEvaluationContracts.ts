import type {
  DeploymentPolicyAdminOverrideRecord,
} from "@application/deployment/DeploymentPolicyAdministrationContracts";
import type { DeploymentPolicyAdministrationState } from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import type { DeploymentPolicyControlMode, DeploymentProfileId } from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import type { DeploymentPolicyResolutionSource } from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";

export const DeploymentPolicyEvaluationSettingPaths = Object.freeze({
  approvalRunSubmissionMode: "approval-governance.runSubmissionApprovalMode",
  approvalHighRiskDualApproval: "approval-governance.highRiskRunRequiresDualApproval",
  approvalEscalationTimeoutMinutes: "approval-governance.approvalEscalationTimeoutMinutes",
  sharingDefaultWorkspaceVisibility: "sharing-posture.defaultWorkspaceVisibility",
  sharingPublicLinkAllowed: "sharing-posture.publicLinkSharingAllowed",
  sharingCrossWorkspaceApprovalRequired: "sharing-posture.crossWorkspaceShareRequiresApproval",
  storageDefaultTier: "storage-governance.defaultStorageTier",
  storageExternalSyncEnabledByDefault: "storage-governance.externalSyncEnabledByDefault",
  storageRetentionDaysDefault: "storage-governance.retentionDaysDefault",
  securityEncryptionAtRestRequired: "security-governance.encryptionAtRestRequired",
  securityTransportTlsRequired: "security-governance.transportTlsRequired",
  securityCredentialRotationDays: "security-governance.localCredentialRotationDays",
  adminDelegatedWorkspaceAdminsAllowed: "admin-controls.allowDelegatedWorkspaceAdmins",
  adminPolicyChangeRequiresTicketReference: "admin-controls.policyChangeRequiresTicketReference",
  adminPolicyDryRunEnabledByDefault: "admin-controls.policyDryRunModeEnabledByDefault",
  auditExportEnabled: "audit-governance.auditExportEnabled",
  auditRedactionStrictMode: "audit-governance.auditRedactionStrictMode",
  auditRetentionDays: "audit-governance.auditRetentionDays",
});

export type DeploymentPolicyEvaluationSettingPath =
  typeof DeploymentPolicyEvaluationSettingPaths[keyof typeof DeploymentPolicyEvaluationSettingPaths];

export type DeploymentApprovalMode =
  | "self-or-owner"
  | "owner-or-instructor"
  | "owner-or-admin"
  | "owner-with-manual-review";

export type DeploymentWorkspaceVisibility = "private" | "workspace" | "organization";

export type DeploymentStorageTier = "local-managed" | "workspace-managed" | "server-managed";

export interface DeploymentPolicySettingValueByPath {
  readonly [DeploymentPolicyEvaluationSettingPaths.approvalRunSubmissionMode]: DeploymentApprovalMode;
  readonly [DeploymentPolicyEvaluationSettingPaths.approvalHighRiskDualApproval]: boolean;
  readonly [DeploymentPolicyEvaluationSettingPaths.approvalEscalationTimeoutMinutes]: number;
  readonly [DeploymentPolicyEvaluationSettingPaths.sharingDefaultWorkspaceVisibility]: DeploymentWorkspaceVisibility;
  readonly [DeploymentPolicyEvaluationSettingPaths.sharingPublicLinkAllowed]: boolean;
  readonly [DeploymentPolicyEvaluationSettingPaths.sharingCrossWorkspaceApprovalRequired]: boolean;
  readonly [DeploymentPolicyEvaluationSettingPaths.storageDefaultTier]: DeploymentStorageTier;
  readonly [DeploymentPolicyEvaluationSettingPaths.storageExternalSyncEnabledByDefault]: boolean;
  readonly [DeploymentPolicyEvaluationSettingPaths.storageRetentionDaysDefault]: number;
  readonly [DeploymentPolicyEvaluationSettingPaths.securityEncryptionAtRestRequired]: boolean;
  readonly [DeploymentPolicyEvaluationSettingPaths.securityTransportTlsRequired]: boolean;
  readonly [DeploymentPolicyEvaluationSettingPaths.securityCredentialRotationDays]: number;
  readonly [DeploymentPolicyEvaluationSettingPaths.adminDelegatedWorkspaceAdminsAllowed]: boolean;
  readonly [DeploymentPolicyEvaluationSettingPaths.adminPolicyChangeRequiresTicketReference]: boolean;
  readonly [DeploymentPolicyEvaluationSettingPaths.adminPolicyDryRunEnabledByDefault]: boolean;
  readonly [DeploymentPolicyEvaluationSettingPaths.auditExportEnabled]: boolean;
  readonly [DeploymentPolicyEvaluationSettingPaths.auditRedactionStrictMode]: boolean;
  readonly [DeploymentPolicyEvaluationSettingPaths.auditRetentionDays]: number;
}

export interface DeploymentPolicyEvaluatedSetting<TValue> {
  readonly path: DeploymentPolicyEvaluationSettingPath;
  readonly familyId: string;
  readonly settingKey: string;
  readonly value: TValue;
  readonly source: DeploymentPolicyResolutionSource;
  readonly controlMode: DeploymentPolicyControlMode;
}

export interface DeploymentPolicyEvaluationContext {
  readonly profileId: DeploymentProfileId;
  readonly evaluatedAt?: string | Date;
  readonly adminState?: DeploymentPolicyAdministrationState;
  readonly overrideRecords?: ReadonlyArray<DeploymentPolicyAdminOverrideRecord>;
}

export interface DeploymentAuthorizationPolicyDecision {
  readonly defaultWorkspaceVisibility: DeploymentPolicyEvaluatedSetting<DeploymentWorkspaceVisibility>;
  readonly publicLinkSharingAllowed: DeploymentPolicyEvaluatedSetting<boolean>;
  readonly crossWorkspaceShareRequiresApproval: DeploymentPolicyEvaluatedSetting<boolean>;
  readonly allowDelegatedWorkspaceAdmins: DeploymentPolicyEvaluatedSetting<boolean>;
}

export interface DeploymentStoragePolicyDecision {
  readonly defaultStorageTier: DeploymentPolicyEvaluatedSetting<DeploymentStorageTier>;
  readonly externalSyncEnabledByDefault: DeploymentPolicyEvaluatedSetting<boolean>;
  readonly retentionDaysDefault: DeploymentPolicyEvaluatedSetting<number>;
}

export interface DeploymentSchedulingPolicyDecision {
  readonly runSubmissionApprovalMode: DeploymentPolicyEvaluatedSetting<DeploymentApprovalMode>;
  readonly highRiskRunRequiresDualApproval: DeploymentPolicyEvaluatedSetting<boolean>;
  readonly approvalEscalationTimeoutMinutes: DeploymentPolicyEvaluatedSetting<number>;
}

export interface DeploymentSecurityPolicyDecision {
  readonly encryptionAtRestRequired: DeploymentPolicyEvaluatedSetting<boolean>;
  readonly transportTlsRequired: DeploymentPolicyEvaluatedSetting<boolean>;
  readonly localCredentialRotationDays: DeploymentPolicyEvaluatedSetting<number>;
}

export interface DeploymentAuditAndAdminPolicyDecision {
  readonly policyChangeRequiresTicketReference: DeploymentPolicyEvaluatedSetting<boolean>;
  readonly policyDryRunModeEnabledByDefault: DeploymentPolicyEvaluatedSetting<boolean>;
  readonly auditExportEnabled: DeploymentPolicyEvaluatedSetting<boolean>;
  readonly auditRedactionStrictMode: DeploymentPolicyEvaluatedSetting<boolean>;
  readonly auditRetentionDays: DeploymentPolicyEvaluatedSetting<number>;
}
