import type { Session } from "../../../src/domain/identity/IdentityDomain";

export interface IdentitySessionTrustEvaluationInput {
  readonly session: Session;
  readonly evaluatedAt: string;
}

export interface IdentitySessionTrustEvaluationAllowed {
  readonly allowed: true;
  readonly trustedDeviceBindingId?: string;
  readonly trustMarker?: string;
}

export interface IdentitySessionTrustEvaluationDenied {
  readonly allowed: false;
  readonly reason: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type IdentitySessionTrustEvaluationResult =
  | IdentitySessionTrustEvaluationAllowed
  | IdentitySessionTrustEvaluationDenied;

export interface IIdentitySessionTrustEvaluator {
  evaluateSessionTrust(
    input: IdentitySessionTrustEvaluationInput,
  ): Promise<IdentitySessionTrustEvaluationResult>;
}
