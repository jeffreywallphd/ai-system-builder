import type {
  AssetImplementationDeploymentProfile,
  AssetImplementationRuntimeKind,
  AssetImplementationTrustLevel,
} from "../asset-implementation";
import type { OrganizationId } from "../organization";
import type { SystemBuildDigest, SystemReleaseId } from "../system-build";
import type { WorkspaceId } from "../workspace";
import type {
  SystemDeploymentAuditId,
  SystemDeploymentId,
  SystemDeploymentRunId,
} from "./system-deployment-id";

export type SystemReferenceRuntimeKind =
  | "secured-data-entry"
  | "controlled-chatbot"
  | "secured-data-review"
  | "custom";

export type SystemDeploymentStatus =
  | "installed"
  | "activating"
  | "active"
  | "degraded"
  | "inactive"
  | "rolling-back"
  | "failed"
  | "revoked";

export type SystemDeploymentHealthStatus =
  "unknown" | "starting" | "ready" | "not-ready" | "unhealthy" | "stopped";

export interface SystemDeploymentDiagnostic {
  readonly severity: "info" | "warning" | "error";
  readonly code: string;
  readonly message: string;
}

export interface SystemDeploymentQuotaPolicy {
  readonly maximumRunSeconds: number;
  readonly maximumMemoryMiB: number;
  readonly maximumOutputBytes: number;
  readonly maximumConcurrentRuns: number;
}

export interface SystemDeploymentEgressPolicy {
  readonly mode: "deny-all" | "allowlist";
  readonly allowedOrigins: readonly string[];
}

export interface SystemDeploymentCapabilityPolicy {
  readonly allowedCapabilities: readonly string[];
  readonly allowedSecretReferences: readonly string[];
  readonly egress: SystemDeploymentEgressPolicy;
  readonly quotas: SystemDeploymentQuotaPolicy;
}

export interface SystemDeploymentCompatibilityEvidence {
  readonly compatible: boolean;
  readonly deploymentProfile: AssetImplementationDeploymentProfile;
  readonly hostApiVersion: string;
  readonly runtimeAbiVersion?: string;
  readonly runtimeKinds: readonly AssetImplementationRuntimeKind[];
  readonly trustLevels: readonly AssetImplementationTrustLevel[];
  readonly sandboxRequired: boolean;
  readonly sandboxQualified: boolean;
  readonly checkedAt: string;
  readonly diagnostics: readonly SystemDeploymentDiagnostic[];
}

export interface SystemDeploymentHealth {
  readonly status: SystemDeploymentHealthStatus;
  readonly checkedAt: string;
  readonly diagnostics: readonly SystemDeploymentDiagnostic[];
}

export interface SystemDeployment {
  readonly deploymentId: SystemDeploymentId;
  readonly organizationId: OrganizationId;
  readonly workspaceId: WorkspaceId;
  readonly releaseId: SystemReleaseId;
  readonly releaseDigest: SystemBuildDigest;
  readonly referenceRuntimeKind: SystemReferenceRuntimeKind;
  readonly deploymentProfile: AssetImplementationDeploymentProfile;
  readonly status: SystemDeploymentStatus;
  readonly revision: number;
  readonly previousDeploymentId?: SystemDeploymentId;
  readonly compatibility: SystemDeploymentCompatibilityEvidence;
  readonly policy: SystemDeploymentCapabilityPolicy;
  readonly health: SystemDeploymentHealth;
  readonly installedAt: string;
  readonly installedBy: string;
  readonly updatedAt: string;
  readonly activatedAt?: string;
  readonly activatedBy?: string;
  readonly revokedAt?: string;
  readonly revokedBy?: string;
}

export type SystemDeploymentRunStatus =
  "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface SystemDeploymentRunUsage {
  readonly durationMilliseconds: number;
  readonly outputBytes: number;
}

export interface SystemDeploymentRun {
  readonly runId: SystemDeploymentRunId;
  readonly deploymentId: SystemDeploymentId;
  readonly organizationId: OrganizationId;
  readonly workspaceId: WorkspaceId;
  readonly releaseId: SystemReleaseId;
  readonly status: SystemDeploymentRunStatus;
  readonly revision: number;
  readonly cancellationRequested: boolean;
  readonly requestedCapabilities: readonly string[];
  readonly requestedSecretReferences: readonly string[];
  readonly requestedEgressOrigins: readonly string[];
  readonly diagnostics: readonly SystemDeploymentDiagnostic[];
  readonly usage?: SystemDeploymentRunUsage;
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly requestedBy: string;
}

export interface SystemDeploymentAuditEntry {
  readonly auditId: SystemDeploymentAuditId;
  readonly organizationId: OrganizationId;
  readonly workspaceId: WorkspaceId;
  readonly deploymentId: SystemDeploymentId;
  readonly runId?: SystemDeploymentRunId;
  readonly action:
    | "install"
    | "activate"
    | "health"
    | "rollback"
    | "revoke"
    | "run-start"
    | "run-cancel"
    | "capability";
  readonly outcome: "allowed" | "denied" | "failed";
  readonly actorId: string;
  readonly reasonCode: string;
  readonly occurredAt: string;
}
