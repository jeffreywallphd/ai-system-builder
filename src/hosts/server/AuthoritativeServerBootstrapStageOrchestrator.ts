import {
  AuthoritativeServerBootstrapStageIds,
  type AuthoritativeServerBootstrapStageId,
} from "./AuthoritativeServerBootstrapStageContracts";
import type { StartupSpan, StartupTracer } from "@hosts/bootstrap/startupTracer";

export class AuthoritativeServerBootstrapStageOrchestratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthoritativeServerBootstrapStageOrchestratorError";
  }
}

interface AuthoritativeServerBootstrapStageOrchestratorStageState {
  readonly stageId: AuthoritativeServerBootstrapStageId;
  readonly sequence: number;
  readonly totalStages: number;
}

export interface AuthoritativeServerBootstrapStageOrchestrator {
  runStage<TResult>(input: {
    readonly stageId: AuthoritativeServerBootstrapStageId;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly run: (input: {
      readonly span: StartupSpan;
      readonly sequence: number;
      readonly totalStages: number;
    }) => Promise<TResult> | TResult;
  }): Promise<TResult>;
}

function normalizeStartupStageOrder(
  stageOrder: ReadonlyArray<AuthoritativeServerBootstrapStageId> | undefined,
): ReadonlyArray<AuthoritativeServerBootstrapStageId> {
  const defaultOrder = Object.freeze([
    AuthoritativeServerBootstrapStageIds.services,
    AuthoritativeServerBootstrapStageIds.security,
    AuthoritativeServerBootstrapStageIds.persistence,
    AuthoritativeServerBootstrapStageIds.transport,
  ]);
  const order = stageOrder ?? defaultOrder;
  if (order.length === 0) {
    throw new AuthoritativeServerBootstrapStageOrchestratorError(
      "Authoritative bootstrap stage order must include at least one stage.",
    );
  }
  const unique = new Set<AuthoritativeServerBootstrapStageId>();
  for (const stageId of order) {
    if (unique.has(stageId)) {
      throw new AuthoritativeServerBootstrapStageOrchestratorError(
        `Authoritative bootstrap stage '${stageId}' is duplicated in stage order.`,
      );
    }
    unique.add(stageId);
  }
  return Object.freeze([...order]);
}

function createStageMetadata(
  stage: AuthoritativeServerBootstrapStageOrchestratorStageState,
  metadata: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    stageId: stage.stageId,
    stageSequence: stage.sequence,
    stageCount: stage.totalStages,
    ...metadata,
  });
}

export function createAuthoritativeServerBootstrapStageOrchestrator(input: {
  readonly tracer: StartupTracer;
  readonly parentSpan?: StartupSpan;
  readonly stageOrder?: ReadonlyArray<AuthoritativeServerBootstrapStageId>;
}): AuthoritativeServerBootstrapStageOrchestrator {
  const orderedStages = normalizeStartupStageOrder(input.stageOrder);
  let nextStageIndex = 0;

  return Object.freeze({
    async runStage<TResult>(stageInput: {
      readonly stageId: AuthoritativeServerBootstrapStageId;
      readonly metadata?: Readonly<Record<string, unknown>>;
      readonly run: (input: {
        readonly span: StartupSpan;
        readonly sequence: number;
        readonly totalStages: number;
      }) => Promise<TResult> | TResult;
    }): Promise<TResult> {
      const expectedStageId = orderedStages[nextStageIndex];
      if (expectedStageId === undefined) {
        throw new AuthoritativeServerBootstrapStageOrchestratorError(
          `Authoritative bootstrap stage '${stageInput.stageId}' was invoked after startup orchestration already completed.`,
        );
      }
      if (stageInput.stageId !== expectedStageId) {
        throw new AuthoritativeServerBootstrapStageOrchestratorError(
          `Authoritative bootstrap stage '${stageInput.stageId}' executed out of order. Expected '${expectedStageId}'.`,
        );
      }
      nextStageIndex += 1;

      const stageState = Object.freeze({
        stageId: stageInput.stageId,
        sequence: nextStageIndex,
        totalStages: orderedStages.length,
      });
      const span = input.parentSpan?.startChild(stageInput.stageId, {
        metadata: createStageMetadata(stageState, stageInput.metadata),
      }) ?? input.tracer.startSpan(stageInput.stageId, {
        metadata: createStageMetadata(stageState, stageInput.metadata),
      });

      try {
        const result = await stageInput.run({
          span,
          sequence: stageState.sequence,
          totalStages: stageState.totalStages,
        });
        span.complete();
        return result;
      } catch (error) {
        span.fail(error);
        throw error;
      }
    },
  });
}
