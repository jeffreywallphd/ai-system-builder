import {
  AuthoritativeServerBootstrapStageIds,
  AuthoritativeServerReadinessCheckStates,
  type AuthoritativeServerSecurityBootstrapStage,
  type AuthoritativeServerReadinessCheck,
  type AuthoritativeServerSecurityStageInput,
  type AuthoritativeServerSecurityStageOutput,
} from "./AuthoritativeServerBootstrapStageContracts";

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
}

export function createAuthoritativeServerSecurityBootstrapStage(
  options?: AuthoritativeServerSecurityBootstrapStageOptions,
): AuthoritativeServerSecurityBootstrapStage {
  return Object.freeze({
    stageId: AuthoritativeServerBootstrapStageIds.security,
    description: "Resolve transport trust, certificate authority readiness, and required secret baseline.",
    async execute(input: AuthoritativeServerSecurityStageInput): Promise<AuthoritativeServerSecurityStageOutput> {
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
      });
    },
  });
}
