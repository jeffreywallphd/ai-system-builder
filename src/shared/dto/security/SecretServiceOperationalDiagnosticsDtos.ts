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
}

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
}
