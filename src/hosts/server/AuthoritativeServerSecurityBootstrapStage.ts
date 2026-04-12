import {
  AuthoritativeServerBootstrapStageIds,
  AuthoritativeServerSecurityMaterialDiagnosticStates,
  AuthoritativeServerSecurityMaterialReadinessStates,
  AuthoritativeServerReadinessCheckStates,
  type AuthoritativeServerSecurityBootstrapStage,
  type AuthoritativeServerReadinessCheck,
  type AuthoritativeServerSecurityMaterialReadinessEntry,
  type AuthoritativeServerSecurityMaterialReadinessIssue,
  type AuthoritativeServerSecurityMaterialReadinessReport,
  type AuthoritativeServerSecurityStageInput,
  type AuthoritativeServerSecurityStageOutput,
} from "./AuthoritativeServerBootstrapStageContracts";
import {
  SecurityMaterialValidationIssueSeverities,
  SecurityMaterialStartupValidationStates,
  type SecurityMaterialStartupValidationResult,
} from "@application/security/services/SecurityMaterialStartupValidationPipeline";
import {
  validateAuthoritativeServerStartupSecurityMaterial,
} from "@infrastructure/security/startup/AuthoritativeServerSecurityMaterialValidationPipeline";

export interface AuthoritativeServerSecurityBootstrapStageOptions {
  readonly resolveTransportTrustReady?: (
    input: AuthoritativeServerSecurityStageInput,
  ) => Promise<boolean> | boolean;
  readonly resolveCertificateAuthorityReady?: (
    input: AuthoritativeServerSecurityStageInput,
  ) => Promise<boolean> | boolean;
  readonly validateRequiredSecrets?: (
    input: AuthoritativeServerSecurityStageInput,
  ) => Promise<boolean> | boolean;
  readonly validateStartupSecurityMaterial?: (
    input: AuthoritativeServerSecurityStageInput,
  ) => Promise<SecurityMaterialStartupValidationResult> | SecurityMaterialStartupValidationResult;
}

export class AuthoritativeServerStartupSecurityMaterialValidationError extends Error {
  public constructor(
    public readonly validationResult: SecurityMaterialStartupValidationResult,
    public readonly securityMaterial: AuthoritativeServerSecurityMaterialReadinessReport,
    public readonly readinessChecks: ReadonlyArray<AuthoritativeServerReadinessCheck>,
  ) {
    super(buildValidationErrorMessage(validationResult));
    this.name = "AuthoritativeServerStartupSecurityMaterialValidationError";
  }
}

export function createAuthoritativeServerSecurityBootstrapStage(
  options?: AuthoritativeServerSecurityBootstrapStageOptions,
): AuthoritativeServerSecurityBootstrapStage {
  return Object.freeze({
    stageId: AuthoritativeServerBootstrapStageIds.security,
    description: "Resolve transport trust, certificate authority readiness, and required secret baseline.",
    async execute(input: AuthoritativeServerSecurityStageInput): Promise<AuthoritativeServerSecurityStageOutput> {
      const startupSecurityMaterialValidation = await (
        options?.validateStartupSecurityMaterial
        ?? ((stageInput) => validateAuthoritativeServerStartupSecurityMaterial({
          deploymentProfile: stageInput.deploymentProfile,
          environment: stageInput.environment,
        }))
      )(input);

      emitStartupSecurityMaterialDiagnostics({
        validation: startupSecurityMaterialValidation,
        logger: input.hostConfiguration.logger,
      });

      const securityMaterial = buildSecurityMaterialReadinessReport(startupSecurityMaterialValidation);
      const startupMaterialValidationCheck = createStartupMaterialValidationCheck(startupSecurityMaterialValidation);

      if (startupSecurityMaterialValidation.state === SecurityMaterialStartupValidationStates.invalid) {
        throw new AuthoritativeServerStartupSecurityMaterialValidationError(
          startupSecurityMaterialValidation,
          securityMaterial,
          Object.freeze([startupMaterialValidationCheck]),
        );
      }

      const transportTrustReady = await (
        options?.resolveTransportTrustReady
        ?? (() => true)
      )(input);
      const certificateAuthorityReady = await (
        options?.resolveCertificateAuthorityReady
        ?? (() => true)
      )(input);
      const requiredSecretsValidated = await (
        options?.validateRequiredSecrets
        ?? (() => true)
      )(input);

      const checks: ReadonlyArray<AuthoritativeServerReadinessCheck> = Object.freeze([
        startupMaterialValidationCheck,
        Object.freeze({
          checkId: "security.transport-trust-material",
          subsystem: "security",
          state: transportTrustReady
            ? AuthoritativeServerReadinessCheckStates.ready
            : AuthoritativeServerReadinessCheckStates.degraded,
          summary: transportTrustReady
            ? "Transport trust material is available."
            : "Transport trust material is unavailable.",
          blocking: false,
        }),
        Object.freeze({
          checkId: "security.certificate-authority-material",
          subsystem: "security",
          state: certificateAuthorityReady
            ? AuthoritativeServerReadinessCheckStates.ready
            : AuthoritativeServerReadinessCheckStates.degraded,
          summary: certificateAuthorityReady
            ? "Certificate authority material is available."
            : "Certificate authority material is unavailable.",
          blocking: false,
        }),
        Object.freeze({
          checkId: "security.required-secrets",
          subsystem: "security",
          state: requiredSecretsValidated
            ? AuthoritativeServerReadinessCheckStates.ready
            : AuthoritativeServerReadinessCheckStates.degraded,
          summary: requiredSecretsValidated
            ? "Required secret material is validated."
            : "Required secret material is not fully validated.",
          blocking: false,
        }),
      ]);

      return Object.freeze({
        checks,
        securityMaterial,
        startupSecurityMaterialValidation,
      });
    },
  });
}

function emitStartupSecurityMaterialDiagnostics(input: {
  readonly validation: SecurityMaterialStartupValidationResult;
  readonly logger:
    | {
      info(event: Readonly<Record<string, unknown>>): void;
      warn(event: Readonly<Record<string, unknown>>): void;
      error(event: Readonly<Record<string, unknown>>): void;
    }
    | undefined;
}): void {
  for (const issue of input.validation.issues) {
    const payload = Object.freeze({
      event: "authoritative-server.startup.security-material-validation",
      details: Object.freeze({
        severity: issue.severity,
        code: issue.code,
        materialId: issue.materialId,
        sourceKind: issue.sourceKind,
        message: issue.message,
        lifecycleStage: input.validation.lifecycleStage,
        productionCapable: input.validation.productionCapable,
        details: sanitizeSecurityMaterialDiagnosticDetails(issue.details),
      }),
    });
    if (issue.severity === SecurityMaterialValidationIssueSeverities.fatal) {
      input.logger?.error(payload);
      continue;
    }
    input.logger?.warn(payload);
  }

  for (const assertion of input.validation.governanceAssertions.entries) {
    const payload = Object.freeze({
      event: "authoritative-server.startup.security-material-governance-assertion",
      details: Object.freeze({
        assertionId: assertion.assertionId,
        materialId: assertion.materialId,
        allowanceKind: assertion.allowanceKind,
        enforcement: assertion.enforcement,
        lifecycleStage: assertion.lifecycleStage,
        productionCapable: assertion.productionCapable,
        sourceKind: assertion.sourceKind,
        message: assertion.message,
        details: sanitizeSecurityMaterialDiagnosticDetails(assertion.details),
      }),
    });
    if (assertion.enforcement === "blocked") {
      input.logger?.error(payload);
      continue;
    }
    input.logger?.warn(payload);
  }
}

function buildValidationErrorMessage(result: SecurityMaterialStartupValidationResult): string {
  const header = "Authoritative startup security material validation failed.";
  const issueLines = result.fatalIssues.map((issue, index) => (
    `${index + 1}. ${issue.materialId}: ${issue.message} (code=${issue.code}, source=${issue.sourceKind})`
  ));
  return [header, ...issueLines].join(" ");
}

function createStartupMaterialValidationCheck(
  validation: SecurityMaterialStartupValidationResult,
): AuthoritativeServerReadinessCheck {
  return Object.freeze({
    checkId: "security.startup-material-validation",
    subsystem: "security",
    state: validation.fatalIssues.length > 0
      ? AuthoritativeServerReadinessCheckStates.failed
      : AuthoritativeServerReadinessCheckStates.ready,
    summary: validation.issues.length > 0
      ? `Startup security material validation produced ${validation.issues.length} diagnostic issue(s).`
      : "Startup security material validation passed without diagnostics.",
    blocking: validation.fatalIssues.length > 0,
      details: Object.freeze({
        lifecycleStage: validation.lifecycleStage,
        fatalIssueCount: String(validation.fatalIssues.length),
        warningCount: String(validation.warnings.length),
        developmentAllowanceWarningCount: String(validation.governanceAssertions.warning),
        developmentAllowanceBlockedCount: String(validation.governanceAssertions.blocked),
        productionCapable: validation.productionCapable ? "true" : "false",
      }),
  });
}

function buildSecurityMaterialReadinessReport(
  validation: SecurityMaterialStartupValidationResult,
): AuthoritativeServerSecurityMaterialReadinessReport {
  const issuesByMaterialId = new Map<string, {
    fatalIssueCount: number;
    warningIssueCount: number;
    issueCodes: Set<string>;
  }>();

  const issues: ReadonlyArray<AuthoritativeServerSecurityMaterialReadinessIssue> = Object.freeze(
    validation.issues.map((issue) => {
      const existing = issuesByMaterialId.get(issue.materialId) ?? {
        fatalIssueCount: 0,
        warningIssueCount: 0,
        issueCodes: new Set<string>(),
      };
      if (issue.severity === SecurityMaterialValidationIssueSeverities.fatal) {
        existing.fatalIssueCount += 1;
      } else {
        existing.warningIssueCount += 1;
      }
      existing.issueCodes.add(issue.code);
      issuesByMaterialId.set(issue.materialId, existing);

      return Object.freeze({
        materialId: issue.materialId,
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
        sourceKind: issue.sourceKind,
        details: sanitizeSecurityMaterialDiagnosticDetails(issue.details),
      });
    }),
  );

  const entries: ReadonlyArray<AuthoritativeServerSecurityMaterialReadinessEntry> = Object.freeze(
    validation.observations.map((observation) => {
      const issueSummary = issuesByMaterialId.get(observation.materialId);
      const fatalIssueCount = issueSummary?.fatalIssueCount ?? 0;
      const warningIssueCount = issueSummary?.warningIssueCount ?? 0;
      const issueCodes = Object.freeze([...(issueSummary?.issueCodes ?? new Set<string>())]);

      const state = !observation.present && observation.sourceKind !== "not-applicable"
        ? AuthoritativeServerSecurityMaterialDiagnosticStates.missing
        : fatalIssueCount > 0
          ? AuthoritativeServerSecurityMaterialDiagnosticStates.nonCompliant
          : warningIssueCount > 0 || !observation.formatValid || observation.persistence === "ephemeral"
            ? AuthoritativeServerSecurityMaterialDiagnosticStates.degraded
            : AuthoritativeServerSecurityMaterialDiagnosticStates.healthy;

      return Object.freeze({
        materialId: observation.materialId,
        state,
        sourceKind: observation.sourceKind,
        present: observation.present,
        formatValid: observation.formatValid,
        persistence: observation.persistence,
        issueCodes,
        fatalIssueCount,
        warningIssueCount,
        details: sanitizeSecurityMaterialDiagnosticDetails(observation.details),
      });
    }),
  );

  const summary = summarizeSecurityMaterialEntries(entries);
  const state = validation.fatalIssues.length > 0
    || validation.governanceAssertions.blocked > 0
    ? AuthoritativeServerSecurityMaterialReadinessStates.blocked
    : validation.warnings.length > 0
      || validation.governanceAssertions.warning > 0
      ? AuthoritativeServerSecurityMaterialReadinessStates.degraded
      : AuthoritativeServerSecurityMaterialReadinessStates.ready;

  return Object.freeze({
    state,
    blocking: state === AuthoritativeServerSecurityMaterialReadinessStates.blocked,
    lifecycleStage: validation.lifecycleStage,
    productionCapable: validation.productionCapable,
    issueCount: validation.issues.length,
    fatalIssueCount: validation.fatalIssues.length,
    warningIssueCount: validation.warnings.length,
    summary,
    issues,
    entries,
    governanceAssertions: Object.freeze({
      total: validation.governanceAssertions.total,
      warning: validation.governanceAssertions.warning,
      blocked: validation.governanceAssertions.blocked,
      entries: Object.freeze(validation.governanceAssertions.entries.map((assertion) => Object.freeze({
        assertionId: assertion.assertionId,
        materialId: assertion.materialId,
        allowanceKind: assertion.allowanceKind,
        lifecycleStage: assertion.lifecycleStage,
        productionCapable: assertion.productionCapable,
        enforcement: assertion.enforcement,
        message: assertion.message,
        sourceKind: assertion.sourceKind,
        details: sanitizeSecurityMaterialDiagnosticDetails(assertion.details),
      }))),
    }),
  });
}

function summarizeSecurityMaterialEntries(
  entries: ReadonlyArray<AuthoritativeServerSecurityMaterialReadinessEntry>,
) {
  let healthy = 0;
  let degraded = 0;
  let missing = 0;
  let nonCompliant = 0;

  for (const entry of entries) {
    if (entry.state === AuthoritativeServerSecurityMaterialDiagnosticStates.healthy) {
      healthy += 1;
      continue;
    }
    if (entry.state === AuthoritativeServerSecurityMaterialDiagnosticStates.degraded) {
      degraded += 1;
      continue;
    }
    if (entry.state === AuthoritativeServerSecurityMaterialDiagnosticStates.missing) {
      missing += 1;
      continue;
    }
    nonCompliant += 1;
  }

  return Object.freeze({
    total: entries.length,
    healthy,
    degraded,
    missing,
    nonCompliant,
  });
}

function sanitizeSecurityMaterialDiagnosticDetails(
  details: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, string>> | undefined {
  if (!details) {
    return undefined;
  }
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(details)) {
    output[key] = redactSecurityMaterialDiagnosticValue(value);
  }
  return Object.freeze(output);
}

function redactSecurityMaterialDiagnosticValue(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return normalized;
  }
  if (normalized.includes("\n") || normalized.includes("\r")) {
    return "[REDACTED]";
  }
  if (/-----BEGIN\s+[A-Z ]+-----/i.test(normalized)) {
    return "[REDACTED]";
  }
  if (/^[A-Za-z0-9+/=]{48,}$/.test(normalized)) {
    return "[REDACTED]";
  }
  return normalized;
}
