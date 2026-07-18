import type {
  SystemDeployment,
  SystemDeploymentDiagnostic,
  SystemDeploymentHealth,
  SystemDeploymentRun,
  SystemReferenceRuntimeKind,
} from "../../../contracts/system-deployment";

export interface SystemDeploymentRuntimeReadiness {
  readonly ready: boolean;
  readonly diagnostics: readonly SystemDeploymentDiagnostic[];
}

export interface SystemDeploymentRuntimeRunResult {
  readonly status: "running" | "succeeded" | "failed";
  readonly diagnostics: readonly SystemDeploymentDiagnostic[];
  readonly durationMilliseconds?: number;
  readonly outputBytes?: number;
}

export interface SystemDeploymentRuntimePort {
  inspect(
    deployment: Pick<
      SystemDeployment,
      "referenceRuntimeKind" | "deploymentProfile" | "compatibility" | "policy"
    >,
  ): Promise<SystemDeploymentRuntimeReadiness>;
  activate(deployment: SystemDeployment): Promise<SystemDeploymentHealth>;
  deactivate(deployment: SystemDeployment): Promise<void>;
  health(deployment: SystemDeployment): Promise<SystemDeploymentHealth>;
  start(
    deployment: SystemDeployment,
    run: SystemDeploymentRun,
  ): Promise<SystemDeploymentRuntimeRunResult>;
  cancel(deployment: SystemDeployment, run: SystemDeploymentRun): Promise<void>;
  supportsReferenceRuntime(kind: SystemReferenceRuntimeKind): boolean;
}
