import { IdentitySessionAccessChannels } from "../../src/domain/identity/IdentityDomain";
import type {
  IdentitySessionLifecyclePolicies,
  IdentitySessionLifecyclePolicy,
} from "../../src/application/identity/services/IdentitySessionLifecycleService";

export interface IdentitySessionPolicyConfigValues {
  readonly desktop?: Partial<IdentitySessionLifecyclePolicy>;
  readonly thinClient?: Partial<IdentitySessionLifecyclePolicy>;
}

const DEFAULT_POLICIES: IdentitySessionLifecyclePolicies = Object.freeze({
  [IdentitySessionAccessChannels.desktop]: Object.freeze({
    ttlMinutes: 60 * 24 * 30,
    allowRefresh: false,
  }),
  [IdentitySessionAccessChannels.thinClient]: Object.freeze({
    ttlMinutes: 60 * 12,
    allowRefresh: true,
  }),
});

export class IdentitySessionPolicyConfig {
  public readonly policies: IdentitySessionLifecyclePolicies;

  public constructor(values: IdentitySessionPolicyConfigValues = {}) {
    this.policies = Object.freeze({
      [IdentitySessionAccessChannels.desktop]: buildPolicy(
        IdentitySessionAccessChannels.desktop,
        DEFAULT_POLICIES[IdentitySessionAccessChannels.desktop],
        values.desktop,
      ),
      [IdentitySessionAccessChannels.thinClient]: buildPolicy(
        IdentitySessionAccessChannels.thinClient,
        DEFAULT_POLICIES[IdentitySessionAccessChannels.thinClient],
        values.thinClient,
      ),
    });
  }

  public static fromEnv(env: Readonly<Record<string, string | undefined>>): IdentitySessionPolicyConfig {
    return new IdentitySessionPolicyConfig({
      desktop: {
        ttlMinutes: parsePositiveInteger(env.IDENTITY_SESSION_DESKTOP_TTL_MINUTES),
        allowRefresh: parseBoolean(env.IDENTITY_SESSION_DESKTOP_ALLOW_REFRESH),
        inactivityTimeoutMinutes: parseOptionalPositiveInteger(env.IDENTITY_SESSION_DESKTOP_INACTIVITY_TIMEOUT_MINUTES),
      },
      thinClient: {
        ttlMinutes: parsePositiveInteger(env.IDENTITY_SESSION_THIN_CLIENT_TTL_MINUTES),
        allowRefresh: parseBoolean(env.IDENTITY_SESSION_THIN_CLIENT_ALLOW_REFRESH),
        inactivityTimeoutMinutes: parseOptionalPositiveInteger(env.IDENTITY_SESSION_THIN_CLIENT_INACTIVITY_TIMEOUT_MINUTES),
      },
    });
  }
}

function buildPolicy(
  channel: string,
  defaults: IdentitySessionLifecyclePolicy,
  overrides: Partial<IdentitySessionLifecyclePolicy> | undefined,
): IdentitySessionLifecyclePolicy {
  const ttlMinutes = overrides?.ttlMinutes ?? defaults.ttlMinutes;
  const allowRefresh = overrides?.allowRefresh ?? defaults.allowRefresh;
  const inactivityTimeoutMinutes = overrides?.inactivityTimeoutMinutes;

  if (!Number.isInteger(ttlMinutes) || ttlMinutes < 1) {
    throw new Error(`Identity session policy '${channel}' requires ttlMinutes >= 1.`);
  }
  if (typeof allowRefresh !== "boolean") {
    throw new Error(`Identity session policy '${channel}' requires allowRefresh boolean.`);
  }
  if (inactivityTimeoutMinutes !== undefined) {
    if (!Number.isInteger(inactivityTimeoutMinutes) || inactivityTimeoutMinutes < 1) {
      throw new Error(`Identity session policy '${channel}' requires inactivityTimeoutMinutes >= 1 when configured.`);
    }
    if (inactivityTimeoutMinutes > ttlMinutes) {
      throw new Error(`Identity session policy '${channel}' requires inactivityTimeoutMinutes <= ttlMinutes.`);
    }
  }

  return Object.freeze({
    ttlMinutes,
    allowRefresh,
    inactivityTimeoutMinutes,
  });
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Identity session policy value '${value}' must be an integer >= 1.`);
  }

  return parsed;
}

function parseOptionalPositiveInteger(value: string | undefined): number | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  return parsePositiveInteger(value);
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new Error(`Identity session policy value '${value}' must be a boolean.`);
}
