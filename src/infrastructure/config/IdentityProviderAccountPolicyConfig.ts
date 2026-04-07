import type { AuthProviderStatus, CredentialPolicy } from "@domain/identity/IdentityDomain";
import { AuthProviderStatuses, createCredentialPolicy } from "@domain/identity/IdentityDomain";

export interface IdentityLocalCredentialPolicyDefaults {
  readonly minLength: number;
  readonly maxLength: number;
  readonly requireLowercase: boolean;
  readonly requireUppercase: boolean;
  readonly requireNumber: boolean;
  readonly requireSymbol: boolean;
  readonly minUniqueCharacters: number;
  readonly maxRepeatedCharacters: number;
  readonly blockedSubstrings: ReadonlyArray<string>;
  readonly minPasswordAgeDays: number;
  readonly maxPasswordAgeDays: number;
  readonly passwordHistoryCount: number;
  readonly maxFailedAttempts: number;
  readonly lockoutDurationMinutes: number;
}

export interface IdentityProviderAccountPolicyConfigValues {
  readonly localProviderId?: string;
  readonly localProviderDisplayName?: string;
  readonly localCredentialPolicyId?: string;
  readonly localProviderEnabled?: boolean;
  readonly bootstrapSeedDefaults?: boolean;
  readonly allowLocalRegistration?: boolean;
  readonly allowLocalAdministration?: boolean;
  readonly localCredentialPolicyDefaults?: Partial<IdentityLocalCredentialPolicyDefaults>;
}

const DEFAULT_LOCAL_PROVIDER_ID = "provider:local-password";
const DEFAULT_LOCAL_PROVIDER_DISPLAY_NAME = "Local Password";
const DEFAULT_LOCAL_CREDENTIAL_POLICY_ID = "policy:local-password";

export class IdentityProviderAccountPolicyConfig {
  public readonly localProviderId: string;
  public readonly localProviderDisplayName: string;
  public readonly localCredentialPolicyId: string;
  public readonly localProviderEnabled: boolean;
  public readonly bootstrapSeedDefaults: boolean;
  public readonly allowLocalRegistration: boolean;
  public readonly allowLocalAdministration: boolean;
  public readonly localCredentialPolicyDefaults: IdentityLocalCredentialPolicyDefaults;

  public constructor(values: IdentityProviderAccountPolicyConfigValues = {}) {
    this.localProviderId = normalizeRequired(values.localProviderId ?? DEFAULT_LOCAL_PROVIDER_ID, "localProviderId");
    this.localProviderDisplayName = normalizeRequired(
      values.localProviderDisplayName ?? DEFAULT_LOCAL_PROVIDER_DISPLAY_NAME,
      "localProviderDisplayName",
    );
    this.localCredentialPolicyId = normalizeRequired(
      values.localCredentialPolicyId ?? DEFAULT_LOCAL_CREDENTIAL_POLICY_ID,
      "localCredentialPolicyId",
    );
    this.localProviderEnabled = values.localProviderEnabled ?? true;
    this.bootstrapSeedDefaults = values.bootstrapSeedDefaults ?? true;
    this.allowLocalRegistration = values.allowLocalRegistration ?? true;
    this.allowLocalAdministration = values.allowLocalAdministration ?? true;
    this.localCredentialPolicyDefaults = this.resolveCredentialPolicyDefaults(values.localCredentialPolicyDefaults);

    if (this.allowLocalRegistration && !this.localProviderEnabled) {
      throw new Error(
        "Identity policy configuration is invalid: allowLocalRegistration requires localProviderEnabled.",
      );
    }
  }

  public get localProviderStatus(): AuthProviderStatus {
    return this.localProviderEnabled ? AuthProviderStatuses.active : AuthProviderStatuses.disabled;
  }

  public buildLocalCredentialPolicy(): CredentialPolicy {
    return createCredentialPolicy({
      id: this.localCredentialPolicyId,
      ...this.localCredentialPolicyDefaults,
    });
  }

  public static fromEnv(
    env: Readonly<Record<string, string | undefined>>,
  ): IdentityProviderAccountPolicyConfig {
    return new IdentityProviderAccountPolicyConfig({
      localProviderId: parseOptionalString(env.IDENTITY_LOCAL_PROVIDER_ID),
      localProviderDisplayName: parseOptionalString(env.IDENTITY_LOCAL_PROVIDER_DISPLAY_NAME),
      localCredentialPolicyId: parseOptionalString(env.IDENTITY_LOCAL_CREDENTIAL_POLICY_ID),
      localProviderEnabled: parseOptionalBoolean(env.IDENTITY_LOCAL_PROVIDER_ENABLED, "IDENTITY_LOCAL_PROVIDER_ENABLED"),
      bootstrapSeedDefaults: parseOptionalBoolean(env.IDENTITY_BOOTSTRAP_SEED_DEFAULTS, "IDENTITY_BOOTSTRAP_SEED_DEFAULTS"),
      allowLocalRegistration: parseOptionalBoolean(
        env.IDENTITY_ACCOUNT_ALLOW_LOCAL_REGISTRATION,
        "IDENTITY_ACCOUNT_ALLOW_LOCAL_REGISTRATION",
      ),
      allowLocalAdministration: parseOptionalBoolean(
        env.IDENTITY_ACCOUNT_ALLOW_ADMINISTRATION,
        "IDENTITY_ACCOUNT_ALLOW_ADMINISTRATION",
      ),
      localCredentialPolicyDefaults: {
        minLength: parseOptionalInteger(env.IDENTITY_LOCAL_CREDENTIAL_MIN_LENGTH, "IDENTITY_LOCAL_CREDENTIAL_MIN_LENGTH", 8),
        maxLength: parseOptionalInteger(env.IDENTITY_LOCAL_CREDENTIAL_MAX_LENGTH, "IDENTITY_LOCAL_CREDENTIAL_MAX_LENGTH", 8),
        requireLowercase: parseOptionalBoolean(
          env.IDENTITY_LOCAL_CREDENTIAL_REQUIRE_LOWERCASE,
          "IDENTITY_LOCAL_CREDENTIAL_REQUIRE_LOWERCASE",
        ),
        requireUppercase: parseOptionalBoolean(
          env.IDENTITY_LOCAL_CREDENTIAL_REQUIRE_UPPERCASE,
          "IDENTITY_LOCAL_CREDENTIAL_REQUIRE_UPPERCASE",
        ),
        requireNumber: parseOptionalBoolean(
          env.IDENTITY_LOCAL_CREDENTIAL_REQUIRE_NUMBER,
          "IDENTITY_LOCAL_CREDENTIAL_REQUIRE_NUMBER",
        ),
        requireSymbol: parseOptionalBoolean(
          env.IDENTITY_LOCAL_CREDENTIAL_REQUIRE_SYMBOL,
          "IDENTITY_LOCAL_CREDENTIAL_REQUIRE_SYMBOL",
        ),
        minUniqueCharacters: parseOptionalInteger(
          env.IDENTITY_LOCAL_CREDENTIAL_MIN_UNIQUE_CHARACTERS,
          "IDENTITY_LOCAL_CREDENTIAL_MIN_UNIQUE_CHARACTERS",
          1,
        ),
        maxRepeatedCharacters: parseOptionalInteger(
          env.IDENTITY_LOCAL_CREDENTIAL_MAX_REPEATED_CHARACTERS,
          "IDENTITY_LOCAL_CREDENTIAL_MAX_REPEATED_CHARACTERS",
          1,
        ),
        blockedSubstrings: parseOptionalCsvList(env.IDENTITY_LOCAL_CREDENTIAL_BLOCKED_SUBSTRINGS),
        minPasswordAgeDays: parseOptionalInteger(
          env.IDENTITY_LOCAL_CREDENTIAL_MIN_PASSWORD_AGE_DAYS,
          "IDENTITY_LOCAL_CREDENTIAL_MIN_PASSWORD_AGE_DAYS",
          0,
        ),
        maxPasswordAgeDays: parseOptionalInteger(
          env.IDENTITY_LOCAL_CREDENTIAL_MAX_PASSWORD_AGE_DAYS,
          "IDENTITY_LOCAL_CREDENTIAL_MAX_PASSWORD_AGE_DAYS",
          1,
        ),
        passwordHistoryCount: parseOptionalInteger(
          env.IDENTITY_LOCAL_CREDENTIAL_PASSWORD_HISTORY_COUNT,
          "IDENTITY_LOCAL_CREDENTIAL_PASSWORD_HISTORY_COUNT",
          0,
        ),
        maxFailedAttempts: parseOptionalInteger(
          env.IDENTITY_LOCAL_CREDENTIAL_MAX_FAILED_ATTEMPTS,
          "IDENTITY_LOCAL_CREDENTIAL_MAX_FAILED_ATTEMPTS",
          1,
        ),
        lockoutDurationMinutes: parseOptionalInteger(
          env.IDENTITY_LOCAL_CREDENTIAL_LOCKOUT_DURATION_MINUTES,
          "IDENTITY_LOCAL_CREDENTIAL_LOCKOUT_DURATION_MINUTES",
          1,
        ),
      },
    });
  }

  private resolveCredentialPolicyDefaults(
    overrides: Partial<IdentityLocalCredentialPolicyDefaults> | undefined,
  ): IdentityLocalCredentialPolicyDefaults {
    const policy = createCredentialPolicy({
      id: "policy:validation",
      minLength: overrides?.minLength,
      maxLength: overrides?.maxLength,
      requireLowercase: overrides?.requireLowercase,
      requireUppercase: overrides?.requireUppercase,
      requireNumber: overrides?.requireNumber,
      requireSymbol: overrides?.requireSymbol,
      minUniqueCharacters: overrides?.minUniqueCharacters,
      maxRepeatedCharacters: overrides?.maxRepeatedCharacters,
      blockedSubstrings: overrides?.blockedSubstrings,
      minPasswordAgeDays: overrides?.minPasswordAgeDays,
      maxPasswordAgeDays: overrides?.maxPasswordAgeDays,
      passwordHistoryCount: overrides?.passwordHistoryCount,
      maxFailedAttempts: overrides?.maxFailedAttempts,
      lockoutDurationMinutes: overrides?.lockoutDurationMinutes,
    });

    return Object.freeze({
      minLength: policy.minLength,
      maxLength: policy.maxLength,
      requireLowercase: policy.requireLowercase,
      requireUppercase: policy.requireUppercase,
      requireNumber: policy.requireNumber,
      requireSymbol: policy.requireSymbol,
      minUniqueCharacters: policy.minUniqueCharacters,
      maxRepeatedCharacters: policy.maxRepeatedCharacters,
      blockedSubstrings: policy.blockedSubstrings,
      minPasswordAgeDays: policy.minPasswordAgeDays,
      maxPasswordAgeDays: policy.maxPasswordAgeDays,
      passwordHistoryCount: policy.passwordHistoryCount,
      maxFailedAttempts: policy.maxFailedAttempts,
      lockoutDurationMinutes: policy.lockoutDurationMinutes,
    });
  }
}

function normalizeRequired(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Identity policy configuration '${fieldName}' must be non-empty.`);
  }

  return normalized;
}

function parseOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseOptionalBoolean(value: string | undefined, envKey: string): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new Error(`Identity policy environment value '${envKey}' must be a boolean.`);
}

function parseOptionalInteger(value: string | undefined, envKey: string, minimum: number): number | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(
      `Identity policy environment value '${envKey}' must be an integer >= ${minimum}.`,
    );
  }

  return parsed;
}

function parseOptionalCsvList(value: string | undefined): ReadonlyArray<string> | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const deduped = new Set<string>();
  for (const entry of value.split(",")) {
    const normalized = entry.trim().toLowerCase();
    if (normalized) {
      deduped.add(normalized);
    }
  }

  return Object.freeze([...deduped.values()]);
}

