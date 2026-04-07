import { AuditRetentionAnchorKinds, type AuditRetentionAnchorKind } from "@domain/audit/AuditDomain";

export class AuditRetentionLifecycleConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditRetentionLifecycleConfigError";
  }
}

export const AuditRetentionLifecycleExecutionModes = Object.freeze({
  metadataOnly: "metadata-only",
});

export type AuditRetentionLifecycleExecutionMode =
  typeof AuditRetentionLifecycleExecutionModes[keyof typeof AuditRetentionLifecycleExecutionModes];

export const AuditRetentionLifecycleEnvironmentKeys = Object.freeze({
  executionMode: "AI_LOOM_AUDIT_RETENTION_EXECUTION_MODE",
  defaultPolicyKey: "AI_LOOM_AUDIT_RETENTION_DEFAULT_POLICY_KEY",
  defaultPolicyVersion: "AI_LOOM_AUDIT_RETENTION_DEFAULT_POLICY_VERSION",
  defaultRetentionAnchor: "AI_LOOM_AUDIT_RETENTION_DEFAULT_ANCHOR",
  allowDestructiveActions: "AI_LOOM_AUDIT_RETENTION_ALLOW_DESTRUCTIVE_ACTIONS",
});

export interface AuditRetentionLifecycleDeploymentProfile {
  readonly profileId: string;
}

export interface ResolvedAuditRetentionLifecycleConfig {
  readonly executionMode: AuditRetentionLifecycleExecutionMode;
  readonly defaultPolicyKey?: string;
  readonly defaultPolicyVersion?: string;
  readonly defaultRetentionAnchor: AuditRetentionAnchorKind;
  readonly destructiveActionsEnabled: false;
}

export function resolveAuditRetentionLifecycleConfig(input?: {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly deploymentProfile?: AuditRetentionLifecycleDeploymentProfile;
}): ResolvedAuditRetentionLifecycleConfig {
  const env = input?.env ?? resolveRuntimeEnvironment();
  const deploymentProfileId = normalizeDeploymentProfileId(input?.deploymentProfile?.profileId);
  const requestedMode = normalizeOptional(env[AuditRetentionLifecycleEnvironmentKeys.executionMode])?.toLowerCase();
  if (
    requestedMode
    && requestedMode !== AuditRetentionLifecycleExecutionModes.metadataOnly
  ) {
    throw new AuditRetentionLifecycleConfigError(
      `Unsupported '${AuditRetentionLifecycleEnvironmentKeys.executionMode}' mode '${requestedMode}'.`,
    );
  }

  const destructiveEnabled = parseBoolean(env[AuditRetentionLifecycleEnvironmentKeys.allowDestructiveActions]) ?? false;
  if (destructiveEnabled) {
    throw new AuditRetentionLifecycleConfigError(
      `${AuditRetentionLifecycleEnvironmentKeys.allowDestructiveActions}=true is not supported. Destructive retention actions are intentionally disabled until governance policy workflows are fully modeled.`,
    );
  }

  const defaultRetentionAnchor = normalizeDefaultRetentionAnchor(
    resolveProfileScopedValue({
      env,
      deploymentProfileId,
      baseEnvironmentKey: AuditRetentionLifecycleEnvironmentKeys.defaultRetentionAnchor,
    }),
  );
  return Object.freeze({
    executionMode: AuditRetentionLifecycleExecutionModes.metadataOnly,
    defaultPolicyKey: normalizeOptional(resolveProfileScopedValue({
      env,
      deploymentProfileId,
      baseEnvironmentKey: AuditRetentionLifecycleEnvironmentKeys.defaultPolicyKey,
    })),
    defaultPolicyVersion: normalizeOptional(resolveProfileScopedValue({
      env,
      deploymentProfileId,
      baseEnvironmentKey: AuditRetentionLifecycleEnvironmentKeys.defaultPolicyVersion,
    })),
    defaultRetentionAnchor,
    destructiveActionsEnabled: false,
  });
}

function normalizeDefaultRetentionAnchor(value: string | undefined): AuditRetentionAnchorKind {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (!normalized) {
    return AuditRetentionAnchorKinds.occurredAt;
  }

  if (normalized === AuditRetentionAnchorKinds.occurredAt) {
    return AuditRetentionAnchorKinds.occurredAt;
  }
  if (normalized === AuditRetentionAnchorKinds.recordedAt) {
    return AuditRetentionAnchorKinds.recordedAt;
  }

  throw new AuditRetentionLifecycleConfigError(
    `Unsupported '${AuditRetentionLifecycleEnvironmentKeys.defaultRetentionAnchor}' value '${normalized}'.`,
  );
}

function resolveRuntimeEnvironment(): Readonly<Record<string, string | undefined>> {
  if (typeof globalThis === "undefined") {
    return Object.freeze({});
  }

  const processLike = (
    globalThis as typeof globalThis & {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process;

  return processLike?.env ?? Object.freeze({});
}

function normalizeDeploymentProfileId(value: string | undefined): string | undefined {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (!/^[a-z0-9][a-z0-9-]{1,63}$/i.test(normalized)) {
    return undefined;
  }

  return normalized;
}

function resolveProfileScopedValue(input: {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly deploymentProfileId?: string;
  readonly baseEnvironmentKey: string;
}): string | undefined {
  if (input.deploymentProfileId) {
    const profileEnvironmentKey = `${input.baseEnvironmentKey}_${input.deploymentProfileId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
    const profileValue = input.env[profileEnvironmentKey];
    if (normalizeOptional(profileValue)) {
      return profileValue;
    }
  }

  return input.env[input.baseEnvironmentKey];
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
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
