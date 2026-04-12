export const DeploymentStates = Object.freeze({
  requested: "requested",
  provisioningInProgress: "provisioning-in-progress",
  provisioningComplete: "provisioning-complete",
  deploymentInProgress: "deployment-in-progress",
  active: "active",
  failed: "failed",
  inactive: "inactive",
});

export type DeploymentState = typeof DeploymentStates[keyof typeof DeploymentStates];

export interface DeploymentStateTransition {
  readonly transitionId: string;
  readonly deploymentId: string;
  readonly fromState?: DeploymentState;
  readonly toState: DeploymentState;
  readonly transitionedAt: string;
  readonly reason?: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface DeploymentStateSnapshot {
  readonly deploymentId: string;
  readonly state: DeploymentState;
  readonly updatedAt: string;
  readonly transitionCount: number;
  readonly lastTransition?: DeploymentStateTransition;
}

export function assertDeploymentStateTransitionAllowed(input: {
  readonly fromState?: DeploymentState;
  readonly toState: DeploymentState;
}): void {
  const { fromState, toState } = input;
  if (!fromState) {
    if (toState !== DeploymentStates.requested && toState !== DeploymentStates.deploymentInProgress) {
      throw new Error(`Invalid initial deployment state transition to '${toState}'.`);
    }
    return;
  }

  const allowed: Readonly<Record<DeploymentState, ReadonlyArray<DeploymentState>>> = Object.freeze({
    [DeploymentStates.requested]: Object.freeze([
      DeploymentStates.provisioningInProgress,
      DeploymentStates.deploymentInProgress,
      DeploymentStates.failed,
      DeploymentStates.inactive,
    ]),
    [DeploymentStates.provisioningInProgress]: Object.freeze([
      DeploymentStates.provisioningComplete,
      DeploymentStates.failed,
      DeploymentStates.inactive,
    ]),
    [DeploymentStates.provisioningComplete]: Object.freeze([
      DeploymentStates.deploymentInProgress,
      DeploymentStates.failed,
      DeploymentStates.inactive,
    ]),
    [DeploymentStates.deploymentInProgress]: Object.freeze([
      DeploymentStates.active,
      DeploymentStates.failed,
      DeploymentStates.inactive,
    ]),
    [DeploymentStates.active]: Object.freeze([DeploymentStates.inactive]),
    [DeploymentStates.failed]: Object.freeze([DeploymentStates.inactive]),
    [DeploymentStates.inactive]: Object.freeze([]),
  });

  if (!allowed[fromState].includes(toState)) {
    throw new Error(`Invalid deployment state transition from '${fromState}' to '${toState}'.`);
  }
}
