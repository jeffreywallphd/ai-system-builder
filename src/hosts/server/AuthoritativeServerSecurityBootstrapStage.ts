import {
  AuthoritativeServerBootstrapStageIds,
  type AuthoritativeServerSecurityBootstrapStage,
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

      return Object.freeze({
        transportTrustReady,
        certificateAuthorityReady,
        requiredSecretsValidated,
      });
    },
  });
}
