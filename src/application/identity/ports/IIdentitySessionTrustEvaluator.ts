import type {
  Session,
  SessionDeviceTrustContext,
  SessionDeviceTrustInvalidationReason,
} from "@domain/identity/IdentityDomain";

export interface IdentitySessionTrustEvaluationInput {
  readonly session: Session;
  readonly evaluatedAt: string;
}

export interface IdentitySessionTrustEvaluationAllowed {
  readonly allowed: true;
  readonly deviceTrustContext?: SessionDeviceTrustContext;
  readonly trustedDeviceBindingId?: string;
  readonly trustMarker?: string;
}

export interface IdentitySessionTrustEvaluationDenied {
  readonly allowed: false;
  readonly reason: string;
  readonly invalidationReasons?: ReadonlyArray<SessionDeviceTrustInvalidationReason>;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly deviceTrustContext?: SessionDeviceTrustContext;
  readonly trustedDeviceBindingId?: string;
  readonly trustMarker?: string;
}

export type IdentitySessionTrustEvaluationResult =
  | IdentitySessionTrustEvaluationAllowed
  | IdentitySessionTrustEvaluationDenied;

export interface IIdentitySessionTrustEvaluator {
  evaluateSessionTrust(
    input: IdentitySessionTrustEvaluationInput,
  ): Promise<IdentitySessionTrustEvaluationResult>;
}

