import type { SystemExecution } from "../../domain/system-runtime/SystemRuntimeDomain";
import { ExecutionStatusKinds } from "../../domain/system-runtime/SystemRuntimeDomain";
import { environmentSupportsTaxonomy, type RuntimeEnvironment } from "../../domain/system-runtime/RuntimeEnvironmentDomain";
import type { ExecutionPlan, ExecutionPlanNode } from "./ExecutionPlanBuilder";

export const StepExecutionStatusKinds = Object.freeze({
  succeeded: ExecutionStatusKinds.succeeded,
  failed: ExecutionStatusKinds.failed,
  cancelled: ExecutionStatusKinds.cancelled,
});

export type StepExecutionStatusKind = typeof StepExecutionStatusKinds[keyof typeof StepExecutionStatusKinds];

export interface StepExecutionRequest {
  readonly plan: ExecutionPlan;
  readonly node: ExecutionPlanNode;
  readonly environment: RuntimeEnvironment;
  readonly execution: SystemExecution;
  readonly input?: unknown;
  readonly startedAt?: string;
  readonly progression?: {
    readonly iteration: number;
    readonly planningCycle: number;
    readonly maxIterations: number;
    readonly maxPlanningCycles: number;
  };
}

export const StepProgressionDecisionKinds = Object.freeze({
  complete: "complete",
  iterate: "iterate",
  replan: "replan",
  unsupported: "unsupported",
});

export type StepProgressionDecisionKind = typeof StepProgressionDecisionKinds[keyof typeof StepProgressionDecisionKinds];

export interface StepProgressionDecision {
  readonly kind: StepProgressionDecisionKind;
  readonly reason?: string;
}

export interface StepExecutionResult {
  readonly nodeId: string;
  readonly status: StepExecutionStatusKind;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly output?: unknown;
  readonly diagnostics?: ReadonlyArray<string>;
  readonly progressionDecision?: StepProgressionDecision;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
}

export interface IStepExecutionAdapter {
  readonly adapterId: string;
  canExecute(node: ExecutionPlanNode): boolean;
  execute(request: StepExecutionRequest): Promise<StepExecutionResult> | StepExecutionResult;
}

export interface IStepExecutionEngine {
  executeStep(request: StepExecutionRequest): Promise<StepExecutionResult>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createFailedResult(input: {
  readonly nodeId: string;
  readonly startedAt: string;
  readonly code: string;
  readonly message: string;
  readonly diagnostics?: ReadonlyArray<string>;
  readonly progressionDecision?: StepProgressionDecision;
}): StepExecutionResult {
  return Object.freeze({
    nodeId: input.nodeId,
    status: StepExecutionStatusKinds.failed,
    startedAt: input.startedAt,
    completedAt: nowIso(),
    diagnostics: input.diagnostics ? Object.freeze([...input.diagnostics]) : undefined,
    progressionDecision: input.progressionDecision,
    error: Object.freeze({
      code: input.code,
      message: input.message,
    }),
  });
}

class BoundedPlanNodeStepExecutionAdapter implements IStepExecutionAdapter {
  public readonly adapterId = "bounded-plan-node-step-adapter";

  public canExecute(): boolean {
    return true;
  }

  public execute(request: StepExecutionRequest): StepExecutionResult {
    const startedAt = request.startedAt ?? nowIso();

    if (!environmentSupportsTaxonomy({ environment: request.environment, taxonomy: request.node.taxonomy })) {
      return createFailedResult({
        nodeId: request.node.nodeId,
        startedAt,
        code: "environment-unsupported-taxonomy",
        message: `Runtime environment '${request.environment.environmentId}' does not support taxonomy structural kind '${request.node.taxonomy.structuralKind}'.`,
      });
    }

    if (request.node.nodeType === "component" && !request.node.componentKind) {
      return createFailedResult({
        nodeId: request.node.nodeId,
        startedAt,
        code: "unsupported-step-type",
        message: `Execution plan node '${request.node.nodeId}' is a component step without a supported component kind.`,
      });
    }

    if (request.node.componentKind === "system") {
      if (!request.environment.capabilities.supportsNestedSystems) {
        return createFailedResult({
          nodeId: request.node.nodeId,
          startedAt,
          code: "nested-systems-unsupported",
          message: `Runtime environment '${request.environment.environmentId}' does not support nested system execution.`,
        });
      }
      if (request.plan.recursion.status !== "complete") {
        return createFailedResult({
          nodeId: request.node.nodeId,
          startedAt,
          code: `recursion-${request.plan.recursion.status}`,
          message: `System-step execution cannot proceed while recursion status is '${request.plan.recursion.status}'.`,
          diagnostics: Object.freeze([
            `maxDepth=${request.plan.recursion.maxDepth}`,
            `unresolvedNestedSystemCount=${request.plan.recursion.unresolvedNestedSystemCount}`,
          ]),
        });
      }
    }

    const progression = request.progression ?? {
      iteration: 0,
      planningCycle: 0,
      maxIterations: 1,
      maxPlanningCycles: 1,
    };

    const diagnostics: string[] = [];
    if (request.node.behavior.supportsBranching) {
      diagnostics.push("branch-capable behavior profile evaluated in bounded mode");
    }
    if (request.node.behavior.supportsIteration) {
      diagnostics.push("iteration-capable behavior profile executed with a single bounded pass");
    }
    if (request.node.behavior.supportsPlanning) {
      diagnostics.push("planner-capable behavior profile evaluated with bounded planning progression");
    }

    let progressionDecision: StepProgressionDecision = Object.freeze({ kind: StepProgressionDecisionKinds.complete });

    if (request.node.behavior.supportsPlanning) {
      if (progression.planningCycle + 1 < progression.maxPlanningCycles) {
        progressionDecision = Object.freeze({
          kind: StepProgressionDecisionKinds.replan,
          reason: `planning-cycle-${progression.planningCycle + 1}-of-${progression.maxPlanningCycles}`,
        });
      }
    } else if (request.node.behavior.supportsIteration) {
      if (progression.iteration + 1 < progression.maxIterations) {
        progressionDecision = Object.freeze({
          kind: StepProgressionDecisionKinds.iterate,
          reason: `iteration-${progression.iteration + 1}-of-${progression.maxIterations}`,
        });
      }
    }

    return Object.freeze({
      nodeId: request.node.nodeId,
      status: StepExecutionStatusKinds.succeeded,
      startedAt,
      completedAt: nowIso(),
      output: Object.freeze({
        nodeType: request.node.nodeType,
        componentKind: request.node.componentKind,
        assetId: request.node.assetId,
        versionId: request.node.versionId,
        executionPattern: request.node.behavior.executionPattern,
        environmentId: request.environment.environmentId,
        behavior: Object.freeze({
          supportsBranching: request.node.behavior.supportsBranching,
          supportsIteration: request.node.behavior.supportsIteration,
          supportsPlanning: request.node.behavior.supportsPlanning,
          boundedPasses: progression.planningCycle + progression.iteration + 1,
        }),
      }),
      diagnostics: diagnostics.length > 0 ? Object.freeze(diagnostics) : undefined,
      progressionDecision,
    });
  }
}

export class StepExecutionEngine implements IStepExecutionEngine {
  private readonly adapters: ReadonlyArray<IStepExecutionAdapter>;

  public constructor(adapters?: ReadonlyArray<IStepExecutionAdapter>) {
    this.adapters = Object.freeze(adapters?.length ? [...adapters] : [new BoundedPlanNodeStepExecutionAdapter()]);
  }

  public async executeStep(request: StepExecutionRequest): Promise<StepExecutionResult> {
    const adapter = this.adapters.find((entry) => entry.canExecute(request.node));
    const startedAt = request.startedAt ?? nowIso();

    if (!adapter) {
      return createFailedResult({
        nodeId: request.node.nodeId,
        startedAt,
        code: "unsupported-step-type",
        message: `No step execution adapter can execute node '${request.node.nodeId}'.`,
      });
    }

    return adapter.execute({
      ...request,
      startedAt,
    });
  }
}
