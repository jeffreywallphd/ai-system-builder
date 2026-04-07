import type {
  IdentitySessionAccessChannel,
  SessionClientContext,
  SessionDeviceTrustContext,
} from "../../../domain/identity/IdentityDomain";
import type {
  IIdentitySessionTrustEvaluator,
  IdentitySessionTrustEvaluationResult,
} from "./IIdentitySessionTrustEvaluator";

export const IdentitySessionTrustRequirements = Object.freeze({
  allowUntrusted: "allow-untrusted",
  allowPairing: "allow-pairing",
  requireTrusted: "require-trusted",
});

export type IdentitySessionTrustRequirement =
  typeof IdentitySessionTrustRequirements[keyof typeof IdentitySessionTrustRequirements];

export interface ResolveSessionIssuanceTrustInput {
  readonly userIdentityId: string;
  readonly accessChannel: IdentitySessionAccessChannel;
  readonly requestedTrustRequirement?: IdentitySessionTrustRequirement;
  readonly client?: SessionClientContext;
  readonly evaluatedAt: string;
}

export interface ResolveSessionIssuanceTrustAllowed {
  readonly allowed: true;
  readonly trustRequirement: IdentitySessionTrustRequirement;
  readonly deviceTrustContext?: SessionDeviceTrustContext;
  readonly trustedDeviceBindingId?: string;
  readonly trustMarker?: string;
}

export interface ResolveSessionIssuanceTrustDenied {
  readonly allowed: false;
  readonly trustRequirement: IdentitySessionTrustRequirement;
  readonly reason: string;
  readonly trustEvaluation?: IdentitySessionTrustEvaluationResult;
}

export type ResolveSessionIssuanceTrustResult =
  | ResolveSessionIssuanceTrustAllowed
  | ResolveSessionIssuanceTrustDenied;

export interface IIdentitySessionTrustService extends IIdentitySessionTrustEvaluator {
  resolveSessionIssuanceTrust(input: ResolveSessionIssuanceTrustInput): Promise<ResolveSessionIssuanceTrustResult>;
}
