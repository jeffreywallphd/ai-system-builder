export const DeploymentLogLevels = Object.freeze({
  info: "info",
  warning: "warning",
  error: "error",
});

export type DeploymentLogLevel = typeof DeploymentLogLevels[keyof typeof DeploymentLogLevels];

export interface DeploymentLogEntry {
  readonly entryId: string;
  readonly deploymentId: string;
  readonly level: DeploymentLogLevel;
  readonly eventKind: string;
  readonly message: string;
  readonly timestamp: string;
  readonly transitionId?: string;
  readonly details?: Readonly<Record<string, string>>;
}

export interface DeploymentDiagnosticRecord {
  readonly diagnosticId: string;
  readonly deploymentId: string;
  readonly timestamp: string;
  readonly code: string;
  readonly summary: string;
  readonly severity: "warning" | "error";
  readonly eventKind: string;
  readonly details?: Readonly<Record<string, string>>;
}
