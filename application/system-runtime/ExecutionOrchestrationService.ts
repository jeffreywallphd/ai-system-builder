import {
  appendExecutionTraceEvent,
  attachExecutionNode,
  decideRecoveryAction,
  ExecutionLogLevels,
  ExecutionTraceEventKinds,
  createSystemExecution,
  ExecutionDecisionKinds,
  ExecutionNodeStatusKinds,
  ExecutionStatusKinds,
  initializeExecutionRuntimeState,
  propagateExecutionFailure,
  RuntimeExecutionErrorKinds,
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

function isRetriableErrorCode(code?: string): boolean {
  return code === "step-transient-failure" || code === "nested-system-transient-failure";
}

function classifyRuntimeErrorKind(input: {
  readonly node: ExecutionPlan["nodes"][number];
  readonly decision: ExecutionDecisionKind;
  readonly stepResult: StepExecutionResult;
}): keyof typeof RuntimeExecutionErrorKinds {
  if (input.stepResult.error?.code === "environment-unsupported-taxonomy" || input.stepResult.error?.code === "nested-systems-unsupported") {
    return "environmentMismatch";
  }
  if (input.node.componentKind === "system") {
    return "nestedSystemFailure";
  }
  if (input.decision === ExecutionDecisionKinds.iterate || input.stepResult.error?.code === "iteration-limit-exceeded") {
    return "iterativeProgressionFailure";
  }
  if (input.decision === ExecutionDecisionKinds.replan || input.stepResult.error?.code === "planning-limit-exceeded") {
    return "autonomousPlanningFailure";
  }
  return "stepFailure";
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
    execution = appendExecutionTraceEvent({
      execution,
      event: {
        eventId: `${execution.executionId}:trace:event:start`,
        kind: ExecutionTraceEventKinds.executionStatusChanged,
        at: startedAt,
        executionId: execution.executionId,
        status: ExecutionStatusKinds.running,
        summary: "Execution started.",
      },
      logEntry: {
        entryId: `${execution.executionId}:trace:log:start`,
        level: ExecutionLogLevels.info,
        message: `Execution '${execution.executionId}' transitioned to running.`,
        emittedAt: startedAt,
      },
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
      execution = appendExecutionTraceEvent({
        execution,
        event: {
          eventId: `${execution.executionId}:trace:event:node-attached:${node.nodeId}`,
          kind: ExecutionTraceEventKinds.nodeAttached,
          at: execution.updatedAt,
          executionId: execution.executionId,
          nodeId: node.nodeId,
          parentNodeId: node.parentNodeId,
          summary: `Execution node '${node.nodeId}' attached.`,
        },
      });
      if (node.componentKind === "system") {
        execution = appendExecutionTraceEvent({
          execution,
          event: {
            eventId: `${execution.executionId}:trace:event:nested-enter:${node.nodeId}`,
            kind: ExecutionTraceEventKinds.nestedSystemEntered,
            at: execution.updatedAt,
            executionId: execution.executionId,
            nodeId: node.nodeId,
            parentNodeId: node.parentNodeId,
            summary: `Entered nested system node '${node.nodeId}'.`,
          },
        });
      }
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
        execution = appendExecutionTraceEvent({
          execution,
          event: {
            eventId: `${execution.executionId}:trace:event:node-running:${node.nodeId}:${passIndex}`,
            kind: ExecutionTraceEventKinds.nodeStatusChanged,
            at: startedAtNode,
            executionId: execution.executionId,
            nodeId: node.nodeId,
            parentNodeId: node.parentNodeId,
            status: ExecutionNodeStatusKinds.running,
            iteration,
            planningCycle,
            summary: `Node '${node.nodeId}' is running.`,
          },
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
          const errorKind = classifyRuntimeErrorKind({ node, decision, stepResult });
          const runtimeError = Object.freeze({
            errorId: `${execution.executionId}:error:${node.nodeId}:${passIndex}`,
            kind: RuntimeExecutionErrorKinds[errorKind],
            code: stepResult.error?.code ?? "step-failed",
            message: stepResult.error?.message ?? "Step execution failed.",
            at: stepResult.completedAt,
            executionId: execution.executionId,
            nodeId: node.nodeId,
            parentNodeId: node.parentNodeId,
            retriable: isRetriableErrorCode(stepResult.error?.code),
            diagnostics: stepResult.diagnostics,
          });
          const recovery = decideRecoveryAction({
            error: runtimeError,
            retryCount: passIndex,
            maxRetries: 1,
          });

          if (recovery.action !== "fail-execution") {
            execution = appendExecutionTraceEvent({
              execution,
              event: {
                eventId: `${execution.executionId}:trace:event:retry:${node.nodeId}:${passIndex}`,
                kind: ExecutionTraceEventKinds.recoveryDecided,
                at: stepResult.completedAt,
                executionId: execution.executionId,
                nodeId: node.nodeId,
                summary: `Retrying node '${node.nodeId}' after recoverable failure.`,
                diagnostics: Object.freeze([recovery.reason]),
                errorCode: runtimeError.code,
              },
            });
            passIndex += 1;
            continue;
          }

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
          execution = propagateExecutionFailure({
            execution,
            error: runtimeError,
            decision: recovery,
            updatedAt: stepResult.completedAt,
            completedAt: stepResult.completedAt,
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
          execution = appendExecutionTraceEvent({
            execution,
            event: {
              eventId: `${execution.executionId}:trace:event:iterate:${node.nodeId}:${passIndex}`,
              kind: ExecutionTraceEventKinds.loopProgressed,
              at: stepResult.completedAt,
              executionId: execution.executionId,
              nodeId: node.nodeId,
              parentNodeId: node.parentNodeId,
              iteration: iteration + 1,
              planningCycle,
              summary: `Node '${node.nodeId}' requested another iteration.`,
              diagnostics: stepResult.diagnostics,
            },
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
          execution = appendExecutionTraceEvent({
            execution,
            event: {
              eventId: `${execution.executionId}:trace:event:replan:${node.nodeId}:${passIndex}`,
              kind: ExecutionTraceEventKinds.autonomousPlanningProgressed,
              at: stepResult.completedAt,
              executionId: execution.executionId,
              nodeId: node.nodeId,
              parentNodeId: node.parentNodeId,
              iteration,
              planningCycle: planningCycle + 1,
              summary: `Node '${node.nodeId}' requested replanning.`,
              diagnostics: stepResult.diagnostics,
            },
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
        execution = appendExecutionTraceEvent({
          execution,
          event: {
            eventId: `${execution.executionId}:trace:event:node-succeeded:${node.nodeId}:${passIndex}`,
            kind: ExecutionTraceEventKinds.nodeStatusChanged,
            at: stepResult.completedAt,
            executionId: execution.executionId,
            nodeId: node.nodeId,
            parentNodeId: node.parentNodeId,
            status: ExecutionNodeStatusKinds.succeeded,
            iteration,
            planningCycle,
            summary: `Node '${node.nodeId}' succeeded.`,
            diagnostics: stepResult.diagnostics,
          },
        });
        if (node.componentKind === "system") {
          execution = appendExecutionTraceEvent({
            execution,
            event: {
              eventId: `${execution.executionId}:trace:event:nested-complete:${node.nodeId}:${passIndex}`,
              kind: ExecutionTraceEventKinds.nestedSystemCompleted,
              at: stepResult.completedAt,
              executionId: execution.executionId,
              nodeId: node.nodeId,
              parentNodeId: node.parentNodeId,
              summary: `Nested system node '${node.nodeId}' completed.`,
            },
          });
        }

        continueProgression = false;
      }
    }

    execution = transitionSystemExecutionStatus({
      execution,
      nextStatus: ExecutionStatusKinds.succeeded,
      updatedAt: nowIso(),
      output: resolveOutput(stepResults),
    });
    execution = appendExecutionTraceEvent({
      execution,
      event: {
        eventId: `${execution.executionId}:trace:event:complete`,
        kind: ExecutionTraceEventKinds.executionStatusChanged,
        at: execution.updatedAt,
        executionId: execution.executionId,
        status: ExecutionStatusKinds.succeeded,
        summary: "Execution completed successfully.",
      },
      logEntry: {
        entryId: `${execution.executionId}:trace:log:complete`,
        level: ExecutionLogLevels.info,
        message: `Execution '${execution.executionId}' completed.`,
        emittedAt: execution.updatedAt,
      },
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
