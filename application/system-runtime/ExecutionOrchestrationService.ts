import {
  attachExecutionNode,
  createSystemExecution,
  ExecutionDecisionKinds,
  ExecutionNodeStatusKinds,
  ExecutionStatusKinds,
  initializeExecutionRuntimeState,
  transitionSystemExecutionStatus,
  updateExecutionNodeState,
  type ExecutionContext,
  type ExecutionDecisionKind,
  type ExecutionEnvironmentRef,
  type ExecutionOutputEnvelope,
  type SystemExecution,
} from "../../domain/system-runtime/SystemRuntimeDomain";
import type { SystemAsset } from "../../domain/system-studio/SystemAssetDomain";
import { RuntimeEnvironmentKinds, type RuntimeEnvironment, type RuntimeEnvironmentKind } from "../../domain/system-runtime/RuntimeEnvironmentDomain";
import { ExecutionPlanBuilder, type ExecutionPlan } from "./ExecutionPlanBuilder";
import type { RuntimeBehaviorProfile } from "./RuntimeBehaviorAlignment";
import type { RuntimeDependencyResolutionResult } from "./RuntimeDependencyResolution";
import type { RuntimeExecutionContract } from "./RuntimeExecutionContractMapping";
import {
  StepExecutionStatusKinds,
  StepProgressionDecisionKinds,
  type IStepExecutionEngine,
  type StepExecutionResult,
} from "./StepExecutionEngine";

export interface ExecutionProgression {
  readonly nodeId: string;
  readonly passIndex: number;
  readonly iteration: number;
  readonly planningCycle: number;
  readonly status: StepExecutionResult["status"];
  readonly decision: ExecutionDecisionKind;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly diagnostics?: ReadonlyArray<string>;
}

export interface ExecutionOrchestrationRequest {
  readonly root: SystemAsset;
  readonly runtimeContract: RuntimeExecutionContract;
  readonly dependencyResolution: RuntimeDependencyResolutionResult;
  readonly behavior: RuntimeBehaviorProfile;
  readonly executionPlan?: ExecutionPlan;
  readonly requestedEnvironmentId?: string;
  readonly requestedEnvironmentKind?: RuntimeEnvironmentKind;
  readonly environment?: RuntimeEnvironment;
  readonly executionId?: string;
  readonly context?: ExecutionContext;
  readonly inputPayload: unknown;
  readonly inputContentType?: string;
  readonly inputSchemaVersion?: string;
  readonly startedAt?: string;
  readonly maxIterationsPerNode?: number;
  readonly maxPlanningCyclesPerNode?: number;
}

export interface ExecutionOrchestrationResult {
  readonly status: "completed" | "failed" | "invalid";
  readonly execution?: SystemExecution;
  readonly plan?: ExecutionPlan;
  readonly progression: ReadonlyArray<ExecutionProgression>;
  readonly stepResults: Readonly<Record<string, StepExecutionResult>>;
  readonly errors: ReadonlyArray<string>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildExecutionEnvironmentRef(environment: RuntimeEnvironment): ExecutionEnvironmentRef {
  return Object.freeze({
    environmentId: environment.environmentId,
    provider: environment.kind,
    labels: Object.freeze([environment.displayName]),
  });
}

function buildExecutionPath(nodeId: string, nodesById: ReadonlyMap<string, ExecutionPlan["nodes"][number]>): ReadonlyArray<string> {
  const path: string[] = [];
  let current = nodesById.get(nodeId);

  while (current) {
    path.unshift(current.nodeId);
    if (!current.parentNodeId) {
      break;
    }
    current = nodesById.get(current.parentNodeId);
  }

  return Object.freeze(path);
}

function resolveOutput(stepResults: Readonly<Record<string, StepExecutionResult>>): ExecutionOutputEnvelope {
  const failed = Object.values(stepResults).find((result) => result.status === StepExecutionStatusKinds.failed);
  if (failed) {
    return Object.freeze({
      producedAt: nowIso(),
      error: failed.error,
      payload: Object.freeze({
        failedNodeId: failed.nodeId,
      }),
    });
  }

  return Object.freeze({
    producedAt: nowIso(),
    payload: Object.freeze({
      nodeResults: Object.fromEntries(Object.values(stepResults).map((entry) => [entry.nodeId, entry.output])),
    }),
  });
}

function mapDecisionKind(result: StepExecutionResult): ExecutionDecisionKind {
  const decisionKind = result.progressionDecision?.kind ?? StepProgressionDecisionKinds.complete;
  switch (decisionKind) {
    case StepProgressionDecisionKinds.iterate:
      return ExecutionDecisionKinds.iterate;
    case StepProgressionDecisionKinds.replan:
      return ExecutionDecisionKinds.replan;
    case StepProgressionDecisionKinds.unsupported:
      return ExecutionDecisionKinds.unsupported;
    default:
      return ExecutionDecisionKinds.complete;
  }
}

function normalizePositive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value as number) > 0 ? Math.floor(value as number) : fallback;
}

function validatePlanForRequest(input: {
  readonly root: SystemAsset;
  readonly plan: ExecutionPlan;
  readonly environment?: RuntimeEnvironment;
}): ReadonlyArray<string> {
  const errors: string[] = [];

  if (input.plan.rootSystemAssetId !== input.root.assetId) {
    errors.push(`Execution plan root '${input.plan.rootSystemAssetId}' does not match requested root '${input.root.assetId}'.`);
  }
  if (input.root.versionId && input.plan.rootSystemVersionId && input.root.versionId !== input.plan.rootSystemVersionId) {
    errors.push(`Execution plan version '${input.plan.rootSystemVersionId}' does not match requested root version '${input.root.versionId}'.`);
  }
  if (input.environment && input.environment.environmentId !== input.plan.environment.environmentId) {
    errors.push(`Execution plan environment '${input.plan.environment.environmentId}' does not match requested environment '${input.environment.environmentId}'.`);
  }
  if (input.plan.nodes.length === 0 || input.plan.orderedNodeIds.length === 0) {
    errors.push("Execution plan must include at least one executable node.");
  }

  return Object.freeze(errors);
}

export class ExecutionOrchestrationService {
  public constructor(
    private readonly stepExecutionEngine: IStepExecutionEngine,
    private readonly planBuilder: ExecutionPlanBuilder = new ExecutionPlanBuilder(),
  ) {}

  public async orchestrate(request: ExecutionOrchestrationRequest): Promise<ExecutionOrchestrationResult> {
    const startedAt = request.startedAt ?? nowIso();

    const plan = request.executionPlan ?? this.buildExecutionPlan(request);
    if (!plan) {
      return Object.freeze({
        status: "invalid",
        progression: Object.freeze([]),
        stepResults: Object.freeze({}),
        errors: Object.freeze(["Execution orchestration requires a valid execution plan."]),
      });
    }

    const environment = request.environment ?? plan.environment;
    const planErrors = validatePlanForRequest({
      root: request.root,
      plan,
      environment: request.environment,
    });

    if (planErrors.length > 0) {
      return Object.freeze({
        status: "invalid",
        plan,
        progression: Object.freeze([]),
        stepResults: Object.freeze({}),
        errors: planErrors,
      });
    }

    const executionId = request.executionId?.trim() || `${plan.planId}:execution:${startedAt}`;
    const nodesById = new Map(plan.nodes.map((node) => [node.nodeId, node] as const));

    let execution = createSystemExecution({
      executionId,
      root: {
        assetId: request.root.assetId,
        versionId: request.root.versionId,
        taxonomy: request.root.taxonomy,
      },
      context: request.context,
      environment: buildExecutionEnvironmentRef(environment),
      status: ExecutionStatusKinds.pending,
      input: {
        payload: request.inputPayload,
        contentType: request.inputContentType,
        schemaVersion: request.inputSchemaVersion,
        capturedAt: startedAt,
      },
      startedAt,
      updatedAt: startedAt,
    });

    execution = transitionSystemExecutionStatus({
      execution,
      nextStatus: ExecutionStatusKinds.running,
      updatedAt: startedAt,
    });
    execution = initializeExecutionRuntimeState({
      execution,
      nodeIds: plan.orderedNodeIds,
      updatedAt: startedAt,
    });

    const progression: ExecutionProgression[] = [];
    const stepResults: Record<string, StepExecutionResult> = {};
    const maxIterationsPerNode = normalizePositive(request.maxIterationsPerNode, 3);
    const maxPlanningCyclesPerNode = normalizePositive(request.maxPlanningCyclesPerNode, 2);

    for (const nodeId of plan.orderedNodeIds) {
      const node = nodesById.get(nodeId);
      if (!node) {
        return Object.freeze({
          status: "invalid",
          plan,
          execution,
          progression: Object.freeze(progression),
          stepResults: Object.freeze({ ...stepResults }),
          errors: Object.freeze([`Execution plan references unknown node '${nodeId}' in orderedNodeIds.`]),
        });
      }

      execution = attachExecutionNode({
        execution,
        node: {
          executionNodeId: node.nodeId,
          parentExecutionNodeId: node.parentNodeId,
          path: buildExecutionPath(node.nodeId, nodesById),
          target: {
            assetId: node.assetId,
            versionId: node.versionId,
            taxonomy: node.taxonomy,
          },
        },
        updatedAt: nowIso(),
      });
      let passIndex = 0;
      let iteration = 0;
      let planningCycle = 0;
      let continueProgression = true;

      while (continueProgression) {
        const startedAtNode = nowIso();
        execution = updateExecutionNodeState({
          execution,
          executionNodeId: node.nodeId,
          status: ExecutionNodeStatusKinds.running,
          startedAt: startedAtNode,
          updatedAt: startedAtNode,
        });

        const stepResult = await this.stepExecutionEngine.executeStep({
          plan,
          node,
          execution,
          environment,
          input: request.inputPayload,
          progression: {
            iteration,
            planningCycle,
            maxIterations: maxIterationsPerNode,
            maxPlanningCycles: maxPlanningCyclesPerNode,
          },
        });
        stepResults[node.nodeId] = stepResult;

        const decision = mapDecisionKind(stepResult);
        progression.push(Object.freeze({
          nodeId: node.nodeId,
          passIndex,
          iteration,
          planningCycle,
          status: stepResult.status,
          decision,
          startedAt: stepResult.startedAt,
          completedAt: stepResult.completedAt,
          diagnostics: stepResult.diagnostics,
        }));

        if (stepResult.status !== StepExecutionStatusKinds.succeeded) {
          execution = updateExecutionNodeState({
            execution,
            executionNodeId: node.nodeId,
            status: stepResult.status === StepExecutionStatusKinds.cancelled
              ? ExecutionNodeStatusKinds.cancelled
              : ExecutionNodeStatusKinds.failed,
            completedAt: stepResult.completedAt,
            updatedAt: stepResult.completedAt,
            decision: {
              kind: decision,
              reason: stepResult.progressionDecision?.reason,
              decidedAt: stepResult.completedAt,
            },
            error: stepResult.error,
          });

          execution = transitionSystemExecutionStatus({
            execution,
            nextStatus: stepResult.status === StepExecutionStatusKinds.cancelled
              ? ExecutionStatusKinds.cancelled
              : ExecutionStatusKinds.failed,
            updatedAt: stepResult.completedAt,
            completedAt: stepResult.completedAt,
            output: resolveOutput(stepResults),
          });

          return Object.freeze({
            status: "failed",
            plan,
            execution,
            progression: Object.freeze(progression),
            stepResults: Object.freeze({ ...stepResults }),
            errors: Object.freeze(stepResult.error ? [stepResult.error.message] : ["Step execution failed."]),
          });
        }

        if (decision === ExecutionDecisionKinds.iterate) {
          iteration += 1;
          execution = updateExecutionNodeState({
            execution,
            executionNodeId: node.nodeId,
            status: ExecutionNodeStatusKinds.running,
            updatedAt: stepResult.completedAt,
            decision: {
              kind: decision,
              reason: stepResult.progressionDecision?.reason,
              decidedAt: stepResult.completedAt,
            },
            incrementIteration: true,
          });
          passIndex += 1;
          if (iteration >= maxIterationsPerNode) {
            execution = updateExecutionNodeState({
              execution,
              executionNodeId: node.nodeId,
              status: ExecutionNodeStatusKinds.failed,
              completedAt: stepResult.completedAt,
              updatedAt: stepResult.completedAt,
              error: {
                code: "iteration-limit-exceeded",
                message: `Node '${node.nodeId}' exceeded bounded iteration limit '${maxIterationsPerNode}'.`,
              },
              decision: {
                kind: ExecutionDecisionKinds.unsupported,
                reason: "bounded-iteration-limit-exceeded",
                decidedAt: stepResult.completedAt,
              },
            });
            execution = transitionSystemExecutionStatus({
              execution,
              nextStatus: ExecutionStatusKinds.failed,
              updatedAt: stepResult.completedAt,
              completedAt: stepResult.completedAt,
              output: resolveOutput(stepResults),
            });
            return Object.freeze({
              status: "failed",
              plan,
              execution,
              progression: Object.freeze(progression),
              stepResults: Object.freeze({ ...stepResults }),
              errors: Object.freeze([`Node '${node.nodeId}' exceeded bounded iteration limit '${maxIterationsPerNode}'.`]),
            });
          }
          continue;
        }

        if (decision === ExecutionDecisionKinds.replan) {
          planningCycle += 1;
          execution = updateExecutionNodeState({
            execution,
            executionNodeId: node.nodeId,
            status: ExecutionNodeStatusKinds.running,
            updatedAt: stepResult.completedAt,
            decision: {
              kind: decision,
              reason: stepResult.progressionDecision?.reason,
              decidedAt: stepResult.completedAt,
            },
            incrementPlanningCycle: true,
          });
          passIndex += 1;
          if (planningCycle >= maxPlanningCyclesPerNode) {
            execution = updateExecutionNodeState({
              execution,
              executionNodeId: node.nodeId,
              status: ExecutionNodeStatusKinds.failed,
              completedAt: stepResult.completedAt,
              updatedAt: stepResult.completedAt,
              error: {
                code: "planning-limit-exceeded",
                message: `Node '${node.nodeId}' exceeded bounded planning-cycle limit '${maxPlanningCyclesPerNode}'.`,
              },
              decision: {
                kind: ExecutionDecisionKinds.unsupported,
                reason: "bounded-planning-limit-exceeded",
                decidedAt: stepResult.completedAt,
              },
            });
            execution = transitionSystemExecutionStatus({
              execution,
              nextStatus: ExecutionStatusKinds.failed,
              updatedAt: stepResult.completedAt,
              completedAt: stepResult.completedAt,
              output: resolveOutput(stepResults),
            });
            return Object.freeze({
              status: "failed",
              plan,
              execution,
              progression: Object.freeze(progression),
              stepResults: Object.freeze({ ...stepResults }),
              errors: Object.freeze([`Node '${node.nodeId}' exceeded bounded planning-cycle limit '${maxPlanningCyclesPerNode}'.`]),
            });
          }
          continue;
        }

        if (decision === ExecutionDecisionKinds.unsupported) {
          execution = updateExecutionNodeState({
            execution,
            executionNodeId: node.nodeId,
            status: ExecutionNodeStatusKinds.failed,
            completedAt: stepResult.completedAt,
            updatedAt: stepResult.completedAt,
            error: {
              code: "unsupported-progression",
              message: `Node '${node.nodeId}' requested unsupported progression.`,
            },
            decision: {
              kind: decision,
              reason: stepResult.progressionDecision?.reason,
              decidedAt: stepResult.completedAt,
            },
          });
          execution = transitionSystemExecutionStatus({
            execution,
            nextStatus: ExecutionStatusKinds.failed,
            updatedAt: stepResult.completedAt,
            completedAt: stepResult.completedAt,
            output: resolveOutput(stepResults),
          });
          return Object.freeze({
            status: "failed",
            plan,
            execution,
            progression: Object.freeze(progression),
            stepResults: Object.freeze({ ...stepResults }),
            errors: Object.freeze([`Node '${node.nodeId}' requested unsupported progression.`]),
          });
        }

        execution = updateExecutionNodeState({
          execution,
          executionNodeId: node.nodeId,
          status: ExecutionNodeStatusKinds.succeeded,
          completedAt: stepResult.completedAt,
          updatedAt: stepResult.completedAt,
          decision: {
            kind: decision,
            reason: stepResult.progressionDecision?.reason,
            decidedAt: stepResult.completedAt,
          },
        });

        continueProgression = false;
      }
    }

    execution = transitionSystemExecutionStatus({
      execution,
      nextStatus: ExecutionStatusKinds.succeeded,
      updatedAt: nowIso(),
      output: resolveOutput(stepResults),
    });

    return Object.freeze({
      status: "completed",
      plan,
      execution,
      progression: Object.freeze(progression),
      stepResults: Object.freeze({ ...stepResults }),
      errors: Object.freeze([]),
    });
  }

  private buildExecutionPlan(request: ExecutionOrchestrationRequest): ExecutionPlan | undefined {
    const result = this.planBuilder.build({
      root: request.root,
      runtimeContract: request.runtimeContract,
      dependencyResolution: request.dependencyResolution,
      behavior: request.behavior,
      requestedEnvironmentId: request.environment?.environmentId ?? request.requestedEnvironmentId,
      requestedEnvironmentKind: request.environment?.kind ?? request.requestedEnvironmentKind ?? RuntimeEnvironmentKinds.local,
    });

    if (result.status !== "built") {
      return undefined;
    }

    return result.plan;
  }
}
