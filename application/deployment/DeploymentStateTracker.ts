import {
  assertDeploymentStateTransitionAllowed,
  type DeploymentState,
  DeploymentStates,
  type DeploymentStateSnapshot,
  type DeploymentStateTransition,
} from "../../domain/deployment/DeploymentStateDomain";

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

export class DeploymentStateTracker {
  public initialize(input: { readonly deploymentId: string; readonly at: string; readonly initialState?: DeploymentState }): {
    readonly state: DeploymentState;
    readonly snapshot: DeploymentStateSnapshot;
    readonly transitions: ReadonlyArray<DeploymentStateTransition>;
  } {
    const deploymentId = normalizeRequired(input.deploymentId, "Deployment state deploymentId");
    const at = normalizeRequired(input.at, "Deployment state timestamp");
    const state = input.initialState ?? DeploymentStates.requested;
    assertDeploymentStateTransitionAllowed({ toState: state });

    const transition = Object.freeze({
      transitionId: `${deploymentId}:transition:0`,
      deploymentId,
      fromState: undefined,
      toState: state,
      transitionedAt: at,
      reason: "deployment-requested",
    } satisfies DeploymentStateTransition);

    return Object.freeze({
      state,
      snapshot: Object.freeze({
        deploymentId,
        state,
        updatedAt: at,
        transitionCount: 1,
        lastTransition: transition,
      }),
      transitions: Object.freeze([transition]),
    });
  }

  public transition(input: {
    readonly deploymentId: string;
    readonly currentState: DeploymentState;
    readonly transitions: ReadonlyArray<DeploymentStateTransition>;
    readonly toState: DeploymentState;
    readonly at: string;
    readonly reason?: string;
    readonly metadata?: Readonly<Record<string, string>>;
  }): {
    readonly state: DeploymentState;
    readonly snapshot: DeploymentStateSnapshot;
    readonly transitions: ReadonlyArray<DeploymentStateTransition>;
    readonly transition: DeploymentStateTransition;
  } {
    const deploymentId = normalizeRequired(input.deploymentId, "Deployment state deploymentId");
    const at = normalizeRequired(input.at, "Deployment state timestamp");
    assertDeploymentStateTransitionAllowed({ fromState: input.currentState, toState: input.toState });

    const transition = Object.freeze({
      transitionId: `${deploymentId}:transition:${input.transitions.length}`,
      deploymentId,
      fromState: input.currentState,
      toState: input.toState,
      transitionedAt: at,
      reason: input.reason?.trim() || undefined,
      metadata: input.metadata,
    } satisfies DeploymentStateTransition);

    const transitions = Object.freeze([...input.transitions, transition]);
    const snapshot = Object.freeze({
      deploymentId,
      state: input.toState,
      updatedAt: at,
      transitionCount: transitions.length,
      lastTransition: transition,
    } satisfies DeploymentStateSnapshot);

    return Object.freeze({
      state: input.toState,
      snapshot,
      transitions,
      transition,
    });
  }
}
