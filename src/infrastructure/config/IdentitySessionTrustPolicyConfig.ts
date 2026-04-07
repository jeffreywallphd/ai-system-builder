import { IdentitySessionAccessChannels } from "@domain/identity/IdentityDomain";
import {
  IdentitySessionTrustRequirements,
  type IdentitySessionTrustRequirement,
} from "@application/identity/ports/IIdentitySessionTrustService";
import type { TrustedDeviceSessionTrustPolicies } from "@application/identity/services/TrustedDeviceSessionTrustService";

export interface IdentitySessionTrustPolicyConfigValues {
  readonly desktop?: IdentitySessionTrustRequirement;
  readonly thinClient?: IdentitySessionTrustRequirement;
}

const DEFAULT_TRUST_POLICIES: TrustedDeviceSessionTrustPolicies = Object.freeze({
  [IdentitySessionAccessChannels.desktop]: IdentitySessionTrustRequirements.allowPairing,
  [IdentitySessionAccessChannels.thinClient]: IdentitySessionTrustRequirements.allowUntrusted,
});

export class IdentitySessionTrustPolicyConfig {
  public readonly policies: TrustedDeviceSessionTrustPolicies;

  public constructor(values: IdentitySessionTrustPolicyConfigValues = {}) {
    this.policies = Object.freeze({
      [IdentitySessionAccessChannels.desktop]: values.desktop ?? DEFAULT_TRUST_POLICIES.desktop,
      [IdentitySessionAccessChannels.thinClient]: values.thinClient ?? DEFAULT_TRUST_POLICIES.thinClient,
    });
  }

  public static fromEnv(env: Readonly<Record<string, string | undefined>>): IdentitySessionTrustPolicyConfig {
    return new IdentitySessionTrustPolicyConfig({
      desktop: parseTrustRequirement(env.IDENTITY_SESSION_DESKTOP_TRUST_REQUIREMENT),
      thinClient: parseTrustRequirement(env.IDENTITY_SESSION_THIN_CLIENT_TRUST_REQUIREMENT),
    });
  }
}

function parseTrustRequirement(value: string | undefined): IdentitySessionTrustRequirement | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === IdentitySessionTrustRequirements.allowUntrusted
    || normalized === IdentitySessionTrustRequirements.allowPairing
    || normalized === IdentitySessionTrustRequirements.requireTrusted
  ) {
    return normalized;
  }

  throw new Error(
    `Identity session trust policy value '${value}' must be one of allow-untrusted, allow-pairing, require-trusted.`,
  );
}

