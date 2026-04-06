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

export interface SecretServiceOperationalDiagnosticsViewDto extends SecretServiceHealthViewDto {
  readonly diagnostics: ReadonlyArray<SecretServiceOperationalDiagnosticDto>;
  readonly bootstrap: {
    readonly requiredSecretIds: ReadonlyArray<string>;
    readonly diagnostics: ReadonlyArray<SecretServiceOperationalDiagnosticDto>;
  };
}
