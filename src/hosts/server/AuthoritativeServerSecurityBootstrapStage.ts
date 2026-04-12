import {
  AuthoritativeServerBootstrapStageIds,
  AuthoritativeServerReadinessCheckStates,
  type AuthoritativeServerSecurityBootstrapStage,
  type AuthoritativeServerReadinessCheck,
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

      if (startupSecurityMaterialValidation.state === SecurityMaterialStartupValidationStates.invalid) {
        throw new AuthoritativeServerStartupSecurityMaterialValidationError(startupSecurityMaterialValidation);
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
        Object.freeze({
          checkId: "security.startup-material-validation",
          subsystem: "security",
          state: startupSecurityMaterialValidation.fatalIssues.length > 0
            ? AuthoritativeServerReadinessCheckStates.failed
            : AuthoritativeServerReadinessCheckStates.ready,
          summary: startupSecurityMaterialValidation.issues.length > 0
            ? `Startup security material validation produced ${startupSecurityMaterialValidation.issues.length} diagnostic issue(s).`
            : "Startup security material validation passed without diagnostics.",
          blocking: startupSecurityMaterialValidation.fatalIssues.length > 0,
          details: Object.freeze({
            lifecycleStage: startupSecurityMaterialValidation.lifecycleStage,
            fatalIssueCount: String(startupSecurityMaterialValidation.fatalIssues.length),
            warningCount: String(startupSecurityMaterialValidation.warnings.length),
            productionCapable: startupSecurityMaterialValidation.productionCapable ? "true" : "false",
          }),
        }),
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
        details: issue.details,
      }),
    });
    if (issue.severity === SecurityMaterialValidationIssueSeverities.fatal) {
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
