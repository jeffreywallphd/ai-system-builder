import {
  WorkflowDraftComparisonOperators,
  type WorkflowDraftConditionDefinition,
} from "@domain/workflow-studio/WorkflowStudioDomain";
import {
  deliverWorkflowExecutionOutputs,
  type WorkflowExecutionOutputDeliveryHandler,
  type WorkflowExecutionOutputDeliveryIssue,
  type WorkflowExecutionOutputDeliveryResult,
} from "./WorkflowExecutionOutputDeliveryService";
import type {
  WorkflowExecutionAssetStepBinding,
  WorkflowDraftActionExecutionPlanElement,
  WorkflowDraftDelayExecutionPlanElement,
  WorkflowDraftExecutionPlan,
  WorkflowDraftExecutionPlanElement,
  WorkflowDraftLoopExecutionPlanElement,
  WorkflowDraftManualExecutionPlanElement,
} from "./WorkflowDraftExecutionPlanMapper";

export const WorkflowDraftRuntimeExecutionStatusKinds = Object.freeze({
  completed: "completed",
  failed: "failed",
  paused: "paused",
});

export type WorkflowDraftRuntimeExecutionStatusKind =
  typeof WorkflowDraftRuntimeExecutionStatusKinds[keyof typeof WorkflowDraftRuntimeExecutionStatusKinds];

export interface WorkflowDraftRuntimeExecutionIssue {
  readonly code: string;
  readonly message: string;
  readonly stepId?: string;
}

export interface WorkflowDraftRuntimeStepTraceEntry {
  readonly sequence: number;
  readonly stepId: string;
  readonly elementType: WorkflowDraftExecutionPlanElement["elementType"];
  readonly status: "completed" | "skipped" | "failed" | "paused";
  readonly invocationSource: string;
  readonly loop?: {
    readonly loopStepId: string;
    readonly iteration: number;
  };
  readonly detail?: string;
  readonly output?: unknown;
}

export interface WorkflowDraftRuntimeManualPause {
  readonly stepId: string;
  readonly prompt: string;
  readonly interactionMode: WorkflowDraftManualExecutionPlanElement["interactionMode"];
  readonly outcomes: ReadonlyArray<string>;
}

export interface WorkflowDraftRuntimeExecutionResult {
  readonly status: WorkflowDraftRuntimeExecutionStatusKind;
  readonly traces: ReadonlyArray<WorkflowDraftRuntimeStepTraceEntry>;
  readonly stepOutputs: Readonly<Record<string, unknown>>;
  readonly issues: ReadonlyArray<WorkflowDraftRuntimeExecutionIssue>;
  readonly outputDelivery: Readonly<{
    readonly results: ReadonlyArray<WorkflowExecutionOutputDeliveryResult>;
    readonly issues: ReadonlyArray<WorkflowExecutionOutputDeliveryIssue>;
  }>;
  readonly pausedAt?: WorkflowDraftRuntimeManualPause;
}

export interface WorkflowDraftRuntimeManualDecision {
  readonly outcome: "continue" | "approve" | "reject";
}

export interface WorkflowDraftRuntimeExecutionRequest {
  readonly plan: WorkflowDraftExecutionPlan;
  readonly inputs?: Readonly<Record<string, unknown>>;
  readonly manualDecisionsByStepId?: Readonly<Record<string, WorkflowDraftRuntimeManualDecision | undefined>>;
  readonly maxLoopIterations?: number;
  readonly actionExecutor?: (
    element: WorkflowDraftActionExecutionPlanElement,
    context: {
      readonly inputs: Readonly<Record<string, unknown>>;
      readonly stepOutputs: Readonly<Record<string, unknown>>;
      readonly loop?: {
        readonly loopStepId: string;
        readonly iteration: number;
        readonly item?: unknown;
      };
    },
  ) => Promise<unknown> | unknown;
  readonly assetStepExecutor?: (
    binding: WorkflowExecutionAssetStepBinding,
    context: {
      readonly inputs: Readonly<Record<string, unknown>>;
      readonly stepOutputs: Readonly<Record<string, unknown>>;
      readonly loop?: {
        readonly loopStepId: string;
        readonly iteration: number;
        readonly item?: unknown;
      };
    },
  ) => Promise<unknown> | unknown;
  readonly outputDeliveryHandler?: WorkflowExecutionOutputDeliveryHandler;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly now?: () => Date;
}

interface RuntimeLoopScope {
  readonly loopStepId: string;
  readonly iteration: number;
  readonly item?: unknown;
}

interface RuntimeExecutionFrame {
  readonly stepId: string;
  readonly invocationSource: string;
  readonly allowRepeat: boolean;
  readonly loop?: RuntimeLoopScope;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    return fallback;
  }
  return value;
}

function coerceBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return Boolean(value);
}

function resolvePathValue(root: unknown, path: string): unknown {
  const normalizedPath = path.trim();
  if (!normalizedPath) {
    return undefined;
  }

  const segments = normalizedPath
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  let cursor: unknown = root;
  for (const segment of segments) {
    if (cursor === undefined || cursor === null) {
      return undefined;
    }

    if (typeof cursor !== "object") {
      return undefined;
    }

    cursor = (cursor as Record<string, unknown>)[segment];
  }

  return cursor;
}

function evaluateComparison(operator: string, left: unknown, right: unknown): boolean {
  switch (operator) {
    case WorkflowDraftComparisonOperators.equals:
      return left === right;
    case WorkflowDraftComparisonOperators.notEquals:
      return left !== right;
    case WorkflowDraftComparisonOperators.greaterThan:
      return typeof left === "number" && typeof right === "number" && left > right;
    case WorkflowDraftComparisonOperators.greaterThanOrEqual:
      return typeof left === "number" && typeof right === "number" && left >= right;
    case WorkflowDraftComparisonOperators.lessThan:
      return typeof left === "number" && typeof right === "number" && left < right;
    case WorkflowDraftComparisonOperators.lessThanOrEqual:
      return typeof left === "number" && typeof right === "number" && left <= right;
    case WorkflowDraftComparisonOperators.contains:
      return typeof left === "string"
        ? typeof right === "string" && left.includes(right)
        : Array.isArray(left)
          ? left.includes(right)
          : false;
    case WorkflowDraftComparisonOperators.startsWith:
      return typeof left === "string" && typeof right === "string" && left.startsWith(right);
    case WorkflowDraftComparisonOperators.endsWith:
      return typeof left === "string" && typeof right === "string" && left.endsWith(right);
    case WorkflowDraftComparisonOperators.exists:
      return left !== undefined && left !== null;
    case WorkflowDraftComparisonOperators.notExists:
      return left === undefined || left === null;
    default:
      return false;
  }
}

function toDurationMilliseconds(element: WorkflowDraftDelayExecutionPlanElement, now: Date): number {
  if (element.mode === "duration") {
    const duration = element.duration;
    if (!duration || !Number.isFinite(duration.value) || duration.value < 0) {
      return 0;
    }

    switch (duration.unit) {
      case "hours":
        return Math.floor(duration.value * 60 * 60 * 1000);
      case "minutes":
        return Math.floor(duration.value * 60 * 1000);
      default:
        return Math.floor(duration.value * 1000);
    }
  }

  const timestamp = element.until?.timestamp;
  if (!timestamp) {
    return 0;
  }

  const targetMs = Date.parse(timestamp);
  if (!Number.isFinite(targetMs)) {
    return 0;
  }

  return Math.max(0, Math.floor(targetMs - now.getTime()));
}

function collectControlledTargetStepIds(plan: WorkflowDraftExecutionPlan): ReadonlySet<string> {
  const controlledTargets = new Set<string>();
  for (const element of plan.elements) {
    if (element.elementType === "built-in.if-then") {
      for (const target of element.branches.then.stepIds ?? []) {
        controlledTargets.add(target);
      }
      for (const target of element.branches.else?.stepIds ?? []) {
        controlledTargets.add(target);
      }
      continue;
    }

    if (element.elementType === "built-in.loop-iteration") {
      for (const target of element.bodyStepIds ?? []) {
        controlledTargets.add(target);
      }
      continue;
    }

    if (element.elementType === "built-in.manual-approval") {
      for (const target of element.outcomes.continue?.stepIds ?? []) {
        controlledTargets.add(target);
      }
      for (const target of element.outcomes.approve?.stepIds ?? []) {
        controlledTargets.add(target);
      }
      for (const target of element.outcomes.reject?.stepIds ?? []) {
        controlledTargets.add(target);
      }
    }
  }

  return controlledTargets;
}

function normalizeRangeIterations(range: WorkflowDraftLoopExecutionPlanElement["range"]): ReadonlyArray<number> {
  if (!range) {
    return Object.freeze([]);
  }

  const start = range.start;
  const end = range.end;
  const step = range.step ?? (end >= start ? 1 : -1);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step) || step === 0) {
    return Object.freeze([]);
  }

  const values: number[] = [];
  if (step > 0) {
    for (let current = start; current <= end; current += step) {
      values.push(current);
    }
  } else {
    for (let current = start; current >= end; current += step) {
      values.push(current);
    }
  }
  return Object.freeze(values);
}

export class WorkflowDraftExecutionRuntime {
  public async execute(request: WorkflowDraftRuntimeExecutionRequest): Promise<WorkflowDraftRuntimeExecutionResult> {
    const elementsById = new Map(request.plan.elements.map((element) => [element.stepId, element] as const));
    const assetStepBindingsByStepId = new Map(
      (request.plan.assetStepBindings ?? []).map((binding) => [binding.stepId, binding] as const),
    );
    const controlledTargetStepIds = collectControlledTargetStepIds(request.plan);
    const traces: WorkflowDraftRuntimeStepTraceEntry[] = [];
    const stepOutputs = new Map<string, unknown>();
    const completedStepIds = new Set<string>();
    const skippedStepIds = new Set<string>();
    const executingStepIds = new Set<string>();
    const topLevelExecutedStepIds = new Set<string>();
    const issues: WorkflowDraftRuntimeExecutionIssue[] = [];
    const maxLoopIterations = normalizePositiveInteger(request.maxLoopIterations, 100);
    const now = request.now ?? (() => new Date());
    const sleep = request.sleep ?? (async (milliseconds: number) => {
      if (milliseconds <= 0) {
        return;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
    });

    let sequence = 0;
    let pausedAt: WorkflowDraftRuntimeManualPause | undefined;

    const pushTrace = (entry: Omit<WorkflowDraftRuntimeStepTraceEntry, "sequence">): void => {
      sequence += 1;
      traces.push(Object.freeze({ ...entry, sequence }));
    };

    const resolveCondition = (
      condition: WorkflowDraftConditionDefinition | undefined,
      loop?: RuntimeLoopScope,
    ): boolean => {
      if (!condition) {
        return false;
      }

      const stepOutputRecord = Object.fromEntries(stepOutputs.entries());
      const expressionContext = Object.freeze({
        inputs: request.inputs ?? Object.freeze({}),
        steps: stepOutputRecord,
        loop: loop
          ? Object.freeze({
            stepId: loop.loopStepId,
            iteration: loop.iteration,
            item: loop.item,
          })
          : undefined,
      });

      if (condition.kind === "comparison") {
        const left = resolvePathValue(expressionContext, condition.leftOperand);
        return evaluateComparison(condition.operator, left, condition.rightOperand);
      }

      const expression = condition.expression?.trim();
      if (!expression) {
        return false;
      }

      try {
        const evaluator = new Function("inputs", "steps", "loop", `return (${expression});`) as (
          inputs: Readonly<Record<string, unknown>>,
          steps: Readonly<Record<string, unknown>>,
          loop?: Readonly<Record<string, unknown>>,
        ) => unknown;
        return coerceBoolean(evaluator(expressionContext.inputs, expressionContext.steps, expressionContext.loop));
      } catch {
        throw new Error(`Condition expression '${expression}' could not be evaluated.`);
      }
    };

    const executeTargets = async (
      stepIds: ReadonlyArray<string> | undefined,
      source: string,
      loop?: RuntimeLoopScope,
      allowRepeat = false,
    ): Promise<boolean> => {
      for (const targetStepId of stepIds ?? []) {
        const succeeded = await executeStep({
          stepId: targetStepId,
          invocationSource: source,
          allowRepeat,
          loop,
        });
        if (!succeeded) {
          return false;
        }
      }
      return true;
    };

    const runAction = async (
      element: WorkflowDraftActionExecutionPlanElement,
      loop?: RuntimeLoopScope,
    ): Promise<unknown> => {
      if (element.stepKind === "asset-backed") {
        const binding = assetStepBindingsByStepId.get(element.stepId);
        if (!binding) {
          throw new Error(`asset-step-binding-missing:${element.stepId}`);
        }
        if (!request.assetStepExecutor) {
          throw new Error(`asset-step-executor-unavailable:${element.stepId}:${binding.invocationKind}`);
        }
        return request.assetStepExecutor(binding, {
          inputs: request.inputs ?? Object.freeze({}),
          stepOutputs: Object.freeze(Object.fromEntries(stepOutputs.entries())),
          loop,
        });
      }

      if (request.actionExecutor) {
        return request.actionExecutor(element, {
          inputs: request.inputs ?? Object.freeze({}),
          stepOutputs: Object.freeze(Object.fromEntries(stepOutputs.entries())),
          loop,
        });
      }

      return Object.freeze({
        stepType: element.stepType,
        stepKind: element.stepKind,
        config: element.config,
        assetRef: element.assetRef,
      });
    };

    const assertStepDependencies = (element: WorkflowDraftExecutionPlanElement): void => {
      for (const dependencyStepId of element.dependsOnStepIds ?? []) {
        if (completedStepIds.has(dependencyStepId) || skippedStepIds.has(dependencyStepId)) {
          continue;
        }
        throw new Error(`Step '${element.stepId}' dependency '${dependencyStepId}' has not completed.`);
      }
    };

    const executeStep = async (frame: RuntimeExecutionFrame): Promise<boolean> => {
      const element = elementsById.get(frame.stepId);
      if (!element) {
        issues.push(Object.freeze({
          code: "step-not-found",
          stepId: frame.stepId,
          message: `Execution plan does not include step '${frame.stepId}'.`,
        }));
        return false;
      }

      if (!frame.allowRepeat && completedStepIds.has(frame.stepId)) {
        return true;
      }

      if (executingStepIds.has(frame.stepId)) {
        issues.push(Object.freeze({
          code: "step-recursion-detected",
          stepId: frame.stepId,
          message: `Recursive control-flow execution detected for step '${frame.stepId}'.`,
        }));
        pushTrace({
          stepId: frame.stepId,
          elementType: element.elementType,
          status: "failed",
          invocationSource: frame.invocationSource,
          loop: frame.loop
            ? Object.freeze({ loopStepId: frame.loop.loopStepId, iteration: frame.loop.iteration })
            : undefined,
          detail: "recursive-control-flow-detected",
        });
        return false;
      }

      try {
        assertStepDependencies(element);
      } catch (error) {
        const message = error instanceof Error ? error.message : "step-dependency-unsatisfied";
        issues.push(Object.freeze({
          code: "step-dependency-unsatisfied",
          stepId: frame.stepId,
          message,
        }));
        pushTrace({
          stepId: frame.stepId,
          elementType: element.elementType,
          status: "failed",
          invocationSource: frame.invocationSource,
          loop: frame.loop
            ? Object.freeze({ loopStepId: frame.loop.loopStepId, iteration: frame.loop.iteration })
            : undefined,
          detail: message,
        });
        return false;
      }

      executingStepIds.add(frame.stepId);
      try {
        if (element.elementType === "action-step") {
          const output = await runAction(element, frame.loop);
          stepOutputs.set(frame.stepId, output);
          completedStepIds.add(frame.stepId);
          pushTrace({
            stepId: frame.stepId,
            elementType: element.elementType,
            status: "completed",
            invocationSource: frame.invocationSource,
            loop: frame.loop
              ? Object.freeze({ loopStepId: frame.loop.loopStepId, iteration: frame.loop.iteration })
              : undefined,
            output,
          });
          return true;
        }

        if (element.elementType === "built-in.if-then") {
          const conditionResult = resolveCondition(element.condition, frame.loop);
          const chosenBranch = conditionResult ? element.branches.then : element.branches.else;
          const chosenStepIds = chosenBranch?.stepIds ?? [];

          const output = Object.freeze({
            branch: conditionResult ? "then" : "else",
            conditionResult,
            selectedStepIds: Object.freeze([...(chosenStepIds ?? [])]),
          });
          stepOutputs.set(frame.stepId, output);
          completedStepIds.add(frame.stepId);
          pushTrace({
            stepId: frame.stepId,
            elementType: element.elementType,
            status: "completed",
            invocationSource: frame.invocationSource,
            loop: frame.loop
              ? Object.freeze({ loopStepId: frame.loop.loopStepId, iteration: frame.loop.iteration })
              : undefined,
            output,
          });

          return executeTargets(
            chosenStepIds,
            `${frame.stepId}:${conditionResult ? "then" : "else"}`,
            frame.loop,
            frame.allowRepeat,
          );
        }

        if (element.elementType === "built-in.loop-iteration") {
          let loopItems: unknown[] = [];
          if (element.mode === "fixed-count") {
            const count = normalizePositiveInteger(element.fixedCount?.count, 1);
            loopItems = Array.from({ length: count }, (_, index) => index);
          } else if (element.mode === "collection") {
            const inputKey = element.collection?.inputKey;
            const rawCollection = inputKey ? (request.inputs as Record<string, unknown> | undefined)?.[inputKey] : undefined;
            if (!Array.isArray(rawCollection)) {
              issues.push(Object.freeze({
                code: "loop-collection-input-invalid",
                stepId: frame.stepId,
                message: `Loop step '${frame.stepId}' expected array input '${inputKey ?? "<missing>"}'.`,
              }));
              pushTrace({
                stepId: frame.stepId,
                elementType: element.elementType,
                status: "failed",
                invocationSource: frame.invocationSource,
                loop: frame.loop
                  ? Object.freeze({ loopStepId: frame.loop.loopStepId, iteration: frame.loop.iteration })
                  : undefined,
                detail: "loop-collection-input-invalid",
              });
              return false;
            }
            loopItems = rawCollection;
          } else if (element.mode === "range") {
            loopItems = [...normalizeRangeIterations(element.range)];
          }

          const boundedItems = loopItems.slice(0, maxLoopIterations);
          let executedIterations = 0;

          for (let index = 0; index < boundedItems.length; index += 1) {
            const loopScope = Object.freeze({
              loopStepId: frame.stepId,
              iteration: index,
              item: boundedItems[index],
            });

            if (resolveCondition(element.exitCondition, loopScope)) {
              break;
            }

            const succeeded = await executeTargets(
              element.bodyStepIds,
              `${frame.stepId}:iteration:${index + 1}`,
              loopScope,
              true,
            );
            if (!succeeded) {
              return false;
            }

            executedIterations += 1;
          }

          if (loopItems.length > maxLoopIterations) {
            issues.push(Object.freeze({
              code: "loop-iteration-limit-applied",
              stepId: frame.stepId,
              message: `Loop step '${frame.stepId}' exceeded configured runtime max iterations '${maxLoopIterations}'.`,
            }));
          }

          const output = Object.freeze({
            mode: element.mode,
            configuredIterations: loopItems.length,
            executedIterations,
            bodyStepIds: Object.freeze([...(element.bodyStepIds ?? [])]),
          });
          stepOutputs.set(frame.stepId, output);
          completedStepIds.add(frame.stepId);
          pushTrace({
            stepId: frame.stepId,
            elementType: element.elementType,
            status: "completed",
            invocationSource: frame.invocationSource,
            loop: frame.loop
              ? Object.freeze({ loopStepId: frame.loop.loopStepId, iteration: frame.loop.iteration })
              : undefined,
            output,
          });
          return true;
        }

        if (element.elementType === "built-in.delay-wait") {
          const waitMs = toDurationMilliseconds(element, now());
          await sleep(waitMs);
          const output = Object.freeze({
            waitMilliseconds: waitMs,
            mode: element.mode,
          });
          stepOutputs.set(frame.stepId, output);
          completedStepIds.add(frame.stepId);
          pushTrace({
            stepId: frame.stepId,
            elementType: element.elementType,
            status: "completed",
            invocationSource: frame.invocationSource,
            loop: frame.loop
              ? Object.freeze({ loopStepId: frame.loop.loopStepId, iteration: frame.loop.iteration })
              : undefined,
            output,
          });
          return true;
        }

        if (element.elementType === "built-in.manual-approval") {
          const selectedOutcome = request.manualDecisionsByStepId?.[frame.stepId]?.outcome;
          if (!selectedOutcome) {
            pausedAt = Object.freeze({
              stepId: frame.stepId,
              prompt: element.prompt,
              interactionMode: element.interactionMode,
              outcomes: Object.freeze(Object.keys(element.outcomes)),
            });
            pushTrace({
              stepId: frame.stepId,
              elementType: element.elementType,
              status: "paused",
              invocationSource: frame.invocationSource,
              loop: frame.loop
                ? Object.freeze({ loopStepId: frame.loop.loopStepId, iteration: frame.loop.iteration })
                : undefined,
              detail: "manual-decision-required",
            });
            return false;
          }

          const outcomeTargets = selectedOutcome === "continue"
            ? element.outcomes.continue?.stepIds
            : selectedOutcome === "approve"
              ? element.outcomes.approve?.stepIds
              : element.outcomes.reject?.stepIds;
          if (!outcomeTargets) {
            issues.push(Object.freeze({
              code: "manual-outcome-unsupported",
              stepId: frame.stepId,
              message: `Manual step '${frame.stepId}' does not define outcome '${selectedOutcome}'.`,
            }));
            pushTrace({
              stepId: frame.stepId,
              elementType: element.elementType,
              status: "failed",
              invocationSource: frame.invocationSource,
              loop: frame.loop
                ? Object.freeze({ loopStepId: frame.loop.loopStepId, iteration: frame.loop.iteration })
                : undefined,
              detail: `manual-outcome-unsupported:${selectedOutcome}`,
            });
            return false;
          }

          const output = Object.freeze({
            outcome: selectedOutcome,
            nextStepIds: Object.freeze([...(outcomeTargets ?? [])]),
          });
          stepOutputs.set(frame.stepId, output);
          completedStepIds.add(frame.stepId);
          pushTrace({
            stepId: frame.stepId,
            elementType: element.elementType,
            status: "completed",
            invocationSource: frame.invocationSource,
            loop: frame.loop
              ? Object.freeze({ loopStepId: frame.loop.loopStepId, iteration: frame.loop.iteration })
              : undefined,
            output,
          });

          return executeTargets(
            outcomeTargets,
            `${frame.stepId}:${selectedOutcome}`,
            frame.loop,
            frame.allowRepeat,
          );
        }

        issues.push(Object.freeze({
          code: "step-type-unsupported",
          stepId: frame.stepId,
          message: `Step '${frame.stepId}' has unsupported element type '${element.elementType}'.`,
        }));
        pushTrace({
          stepId: frame.stepId,
          elementType: element.elementType,
          status: "failed",
          invocationSource: frame.invocationSource,
          loop: frame.loop
            ? Object.freeze({ loopStepId: frame.loop.loopStepId, iteration: frame.loop.iteration })
            : undefined,
          detail: "step-type-unsupported",
        });
        return false;
      } catch (error) {
        const message = error instanceof Error ? error.message : "workflow-runtime-execution-failed";
        issues.push(Object.freeze({
          code: "workflow-runtime-step-failed",
          stepId: frame.stepId,
          message,
        }));
        pushTrace({
          stepId: frame.stepId,
          elementType: element.elementType,
          status: "failed",
          invocationSource: frame.invocationSource,
          loop: frame.loop
            ? Object.freeze({ loopStepId: frame.loop.loopStepId, iteration: frame.loop.iteration })
            : undefined,
          detail: message,
        });
        return false;
      } finally {
        executingStepIds.delete(frame.stepId);
      }
    };

    const topLevelSteps = request.plan.orderedStepIds.filter((stepId) => !controlledTargetStepIds.has(stepId));
    for (const stepId of topLevelSteps) {
      if (topLevelExecutedStepIds.has(stepId)) {
        continue;
      }

      topLevelExecutedStepIds.add(stepId);
      const succeeded = await executeStep({
        stepId,
        invocationSource: "entry",
        allowRepeat: false,
      });
      if (!succeeded) {
        if (pausedAt) {
          return Object.freeze({
            status: WorkflowDraftRuntimeExecutionStatusKinds.paused,
            traces: Object.freeze([...traces]),
            stepOutputs: Object.freeze(Object.fromEntries(stepOutputs.entries())),
            issues: Object.freeze([...issues]),
            outputDelivery: Object.freeze({
              results: Object.freeze([]),
              issues: Object.freeze([]),
            }),
            pausedAt,
          });
        }

        return Object.freeze({
          status: WorkflowDraftRuntimeExecutionStatusKinds.failed,
          traces: Object.freeze([...traces]),
          stepOutputs: Object.freeze(Object.fromEntries(stepOutputs.entries())),
          issues: Object.freeze([...issues]),
          outputDelivery: Object.freeze({
            results: Object.freeze([]),
            issues: Object.freeze([]),
          }),
        });
      }
    }

    for (const stepId of request.plan.orderedStepIds) {
      if (completedStepIds.has(stepId)) {
        continue;
      }
      const element = elementsById.get(stepId);
      if (!element) {
        continue;
      }
      skippedStepIds.add(stepId);
      pushTrace({
        stepId,
        elementType: element.elementType,
        status: "skipped",
        invocationSource: "post-run",
        detail: controlledTargetStepIds.has(stepId)
          ? "control-target-not-selected"
          : "not-reachable",
      });
    }

    const outputDelivery = await deliverWorkflowExecutionOutputs(
      {
        plan: request.plan,
        stepOutputs: Object.freeze(Object.fromEntries(stepOutputs.entries())),
        traces: Object.freeze(
          traces.map((trace) => Object.freeze({
            sequence: trace.sequence,
            stepId: trace.stepId,
            status: trace.status,
          })),
        ),
      },
      request.outputDeliveryHandler,
    );
    if (outputDelivery.issues.length > 0) {
      const mergedIssues = Object.freeze([
        ...issues,
        ...outputDelivery.issues.map((issue) => Object.freeze({
          code: issue.code,
          stepId: issue.outputId,
          message: issue.message,
        })),
      ]);
      return Object.freeze({
        status: WorkflowDraftRuntimeExecutionStatusKinds.failed,
        traces: Object.freeze([...traces]),
        stepOutputs: Object.freeze(Object.fromEntries(stepOutputs.entries())),
        issues: mergedIssues,
        outputDelivery: Object.freeze({
          results: Object.freeze([...outputDelivery.results]),
          issues: Object.freeze([...outputDelivery.issues]),
        }),
      });
    }

    return Object.freeze({
      status: WorkflowDraftRuntimeExecutionStatusKinds.completed,
      traces: Object.freeze([...traces]),
      stepOutputs: Object.freeze(Object.fromEntries(stepOutputs.entries())),
      issues: Object.freeze([...issues]),
      outputDelivery: Object.freeze({
        results: Object.freeze([...outputDelivery.results]),
        issues: Object.freeze([...outputDelivery.issues]),
      }),
    });
  }
}

