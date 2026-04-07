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

export interface ResolvedAuditRetentionLifecycleConfig {
  readonly executionMode: AuditRetentionLifecycleExecutionMode;
  readonly defaultPolicyKey?: string;
  readonly defaultPolicyVersion?: string;
  readonly defaultRetentionAnchor: AuditRetentionAnchorKind;
  readonly destructiveActionsEnabled: false;
}

export function resolveAuditRetentionLifecycleConfig(input?: {
  readonly env?: Readonly<Record<string, string | undefined>>;
}): ResolvedAuditRetentionLifecycleConfig {
  const env = input?.env ?? resolveRuntimeEnvironment();
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
    env[AuditRetentionLifecycleEnvironmentKeys.defaultRetentionAnchor],
  );
  return Object.freeze({
    executionMode: AuditRetentionLifecycleExecutionModes.metadataOnly,
    defaultPolicyKey: normalizeOptional(env[AuditRetentionLifecycleEnvironmentKeys.defaultPolicyKey]),
    defaultPolicyVersion: normalizeOptional(env[AuditRetentionLifecycleEnvironmentKeys.defaultPolicyVersion]),
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
