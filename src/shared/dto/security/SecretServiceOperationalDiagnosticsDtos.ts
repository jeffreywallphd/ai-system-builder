export const SecretServiceHealthStates = Object.freeze({
  healthy: "healthy",
  degraded: "degraded",
  unhealthy: "unhealthy",
} as const);

export type SecretServiceHealthState = typeof SecretServiceHealthStates[keyof typeof SecretServiceHealthStates];

export const SecretServiceDiagnosticSeverities = Object.freeze({
  info: "info",
  warning: "warning",
  error: "error",
} as const);

export type SecretServiceDiagnosticSeverity =
  typeof SecretServiceDiagnosticSeverities[keyof typeof SecretServiceDiagnosticSeverities];

export interface SecretServiceHealthFlagsDto {
  readonly encryptionMaterialAvailable: boolean;
  readonly repositoryReachable: boolean;
  readonly bootstrapSecretsHealthy: boolean;
  readonly runtimeDependenciesHealthy: boolean;
}

export interface SecretServiceHealthViewDto {
  readonly state: SecretServiceHealthState;
  readonly checkedAt: string;
  readonly healthFlags: SecretServiceHealthFlagsDto;
}

export interface SecretServiceOperationalDiagnosticDto {
  readonly code: string;
  readonly severity: SecretServiceDiagnosticSeverity;
  readonly message: string;
  readonly secretId?: string;
  readonly startupRequirement?: "fail-fast-required" | "optional";
  readonly durabilityClass?: "durable" | "ephemeral";
  readonly fallbackPolicy?: "none" | "migrate-legacy-input" | "generate-ephemeral-for-development";
}

export const SecurityMaterialDiagnosticStates = Object.freeze({
  healthy: "healthy",
  degraded: "degraded",
  missing: "missing",
  nonCompliant: "non-compliant",
} as const);

export type SecurityMaterialDiagnosticState =
  typeof SecurityMaterialDiagnosticStates[keyof typeof SecurityMaterialDiagnosticStates];

export interface SecretProviderMaterialMetadataDto {
  readonly providerId: string;
  readonly secretId: string;
  readonly scope: "server" | "workspace" | "user";
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
  readonly materialKind: string;
  readonly backend: {
    readonly backendId: string;
    readonly backendKind: string;
  };
  readonly reference: {
    readonly secretId: string;
    readonly name: string;
    readonly scope: "server" | "workspace" | "user";
    readonly workspaceId?: string;
    readonly userIdentityId?: string;
    readonly kind: string;
    readonly state: string;
    readonly currentVersionId?: string;
    readonly metadata: {
      readonly displayName?: string;
      readonly description?: string;
      readonly tags: ReadonlyArray<string>;
      readonly labels: Readonly<Record<string, string>>;
    };
    readonly updatedAt: string;
  };
  readonly timestamps: {
    readonly createdAt?: string;
    readonly updatedAt: string;
  };
  readonly rotation: {
    readonly status: string;
    readonly currentVersionId?: string;
  };
  readonly policyFlags: {
    readonly metadataSafeForDiagnostics: true;
    readonly plaintextAccessRequiresDedicatedRetrievalFlow: true;
    readonly failFastRequiredOnStartup?: boolean;
  };
}

export interface SecretServiceOperationalDiagnosticsViewDto extends SecretServiceHealthViewDto {
  readonly diagnostics: ReadonlyArray<SecretServiceOperationalDiagnosticDto>;
  readonly bootstrap: {
    readonly requiredSecretIds: ReadonlyArray<string>;
    readonly diagnostics: ReadonlyArray<SecretServiceOperationalDiagnosticDto>;
    readonly materialMetadata: ReadonlyArray<SecretProviderMaterialMetadataDto>;
  };
  readonly securityMaterial: {
    readonly lifecycleStage: "production" | "development" | "test";
    readonly summary: {
      readonly total: number;
      readonly healthy: number;
      readonly degraded: number;
      readonly missing: number;
      readonly nonCompliant: number;
    };
    readonly entries: ReadonlyArray<{
      readonly secretId: string;
      readonly state: SecurityMaterialDiagnosticState;
      readonly present: boolean;
      readonly degraded: boolean;
      readonly nonCompliant: boolean;
      readonly fallbackModeActive: boolean;
      readonly provider: {
        readonly providerId: string;
        readonly materialKind: "provider-credential" | "signing-material";
      };
      readonly classification: {
        readonly materialId: string;
        readonly category: "secret-credential" | "signing-material" | "encryption-key" | "certificate-material" | "transport-trust";
        readonly scope: "server" | "workspace" | "user" | "storage-instance";
        readonly rotationPosture: "manual" | "scheduled" | "on-demand" | "not-applicable";
        readonly usageContexts: ReadonlyArray<
          "startup-bootstrap" | "runtime-request" | "provider-credential" | "server-signing" | "transport-security"
        >;
      };
      readonly policy: {
        readonly startupRequirement: "fail-fast-required" | "optional";
        readonly durabilityClass: "durable" | "ephemeral";
        readonly fallbackPolicy: "none" | "migrate-legacy-input" | "generate-ephemeral-for-development";
      };
      readonly backend?: {
        readonly backendId: string;
        readonly backendKind: string;
      };
      readonly rotation: {
        readonly status: string;
        readonly currentVersionId?: string;
      };
      readonly validation: {
        readonly failures: ReadonlyArray<SecretServiceOperationalDiagnosticDto>;
        readonly warnings: ReadonlyArray<SecretServiceOperationalDiagnosticDto>;
      };
    }>;
  };
}
