import type { Agent } from "@domain/agents/Agent";
import type { AgentExecutionSession } from "@domain/agents/AgentExecutionSession";
import type { CompositionTaxonomyDescriptor } from "@domain/taxonomy/CompositionTaxonomy";
import type { AssetContractDescriptor } from "@domain/contracts/AssetContract";
import type { AgentRunnerResult } from "../services/AgentRunnerService";
import type { AgentExecutionSessionTransitionRecord } from "../../ports/interfaces/IAgentExecutionSessionRepository";

export const AgentTriggerKinds = Object.freeze({
  manual: "manual",
  backend: "backend",
});

export type AgentTriggerKind = typeof AgentTriggerKinds[keyof typeof AgentTriggerKinds];

export interface AgentRunTrigger {
  readonly kind: AgentTriggerKind;
  readonly invokedBy?: string;
  readonly source?: string;
}

export interface AgentRunRequest {
  readonly agentId: string;
  readonly input?: Readonly<Record<string, unknown>>;
  readonly contextOverrides?: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly trigger?: AgentRunTrigger;
}

export interface AgentRuntimeBinding {
  readonly agentId: string;
  readonly persistedConfigurationRevision: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly contextOverrides: Readonly<Record<string, unknown>>;
  readonly metadata: Readonly<Record<string, string>>;
  readonly trigger: AgentRunTrigger;
}

export interface AgentSessionSummaryReadModel {
  readonly sessionId: string;
  readonly agentId: string;
  readonly planId?: string;
  readonly status: AgentExecutionSession["status"];
  readonly terminalReason?: "completed" | "failed" | "cancelled" | "blocked";
  readonly hadPartialProgress: boolean;
  readonly completedStepCount: number;
  readonly attemptedStepCount: number;
  readonly stepOutcomeCount: number;
  readonly startedAt: string;
  readonly endedAt?: string;
  readonly composition: {
    readonly taxonomy: CompositionTaxonomyDescriptor;
    readonly contract?: AssetContractDescriptor;
  };
}

export interface AgentOperationalProjection {
  readonly executionProgress: {
    readonly completedStepCount: number;
    readonly attemptedStepCount: number;
    readonly hadPartialProgress: boolean;
  };
  readonly retrySummary: {
    readonly attemptedSteps: number;
    readonly totalAttempts: number;
    readonly retriedSteps: number;
  };
  readonly outcomeSummary: {
    readonly completed: number;
    readonly failed: number;
    readonly cancelled: number;
    readonly blocked: number;
    readonly outputAssetIds: ReadonlyArray<string>;
  };
  readonly stepOutcomes: ReadonlyArray<{
    readonly stepId: string;
    readonly status: "completed" | "failed" | "cancelled" | "blocked";
    readonly attempts: number;
    readonly toolId?: string;
    readonly outputAssetId?: string;
    readonly errorMessage?: string;
  }>;
  readonly diagnosticSummary: {
    readonly count: number;
    readonly assetReferences: ReadonlyArray<{
      readonly assetId: string;
      readonly assetVersionId?: string;
    }>;
  };
}

export interface AgentSessionDetailReadModel {
  readonly summary: AgentSessionSummaryReadModel;
  readonly transitionHistory: ReadonlyArray<AgentExecutionSessionTransitionRecord>;
  readonly operational: AgentOperationalProjection;
  readonly composition: {
    readonly taxonomy: CompositionTaxonomyDescriptor;
    readonly contract?: AssetContractDescriptor;
  };
}

export interface AgentLaunchReadModel {
  readonly launch: {
    readonly executionId: string;
    readonly status: "completed" | "failed" | "cancelled" | "blocked";
  };
  readonly binding: AgentRuntimeBinding;
  readonly session: AgentSessionSummaryReadModel;
  readonly operational: AgentOperationalProjection & {
    readonly memoryWriteSummary: {
      readonly persistedCount: number;
      readonly skippedCount: number;
      readonly persistedAssetIds: ReadonlyArray<string>;
    };
  };
  readonly composition: {
    readonly taxonomy: CompositionTaxonomyDescriptor;
    readonly contract?: AssetContractDescriptor;
  };
}

export const AgentRunControlActions = Object.freeze({
  cancel: "cancel",
  pause: "pause",
  resume: "resume",
});

export type AgentRunControlAction = typeof AgentRunControlActions[keyof typeof AgentRunControlActions];

export interface AgentRunControlRequest {
  readonly sessionId: string;
  readonly action: AgentRunControlAction;
}

function normalizeRecord(
  value: Readonly<Record<string, unknown>> | undefined,
  fieldName: "input" | "contextOverrides",
): Readonly<Record<string, unknown>> {
  if (!value) {
    return Object.freeze({});
  }
  if (Array.isArray(value)) {
    throw new Error(`Agent run request ${fieldName} must be a key/value object.`);
  }

  const normalized: Record<string, unknown> = {};
  for (const [rawKey, entry] of Object.entries(value)) {
    const key = rawKey.trim();
    if (!key) {
      throw new Error(`Agent run request ${fieldName} keys must be non-empty when provided.`);
    }
    normalized[key] = entry;
  }

  return Object.freeze(normalized);
}

function normalizeMetadata(value: Readonly<Record<string, string>> | undefined): Readonly<Record<string, string>> {
  if (!value) {
    return Object.freeze({});
  }

  const normalized: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    const normalizedKey = key.trim();
    const normalizedValue = raw.trim();
    if (!normalizedKey || !normalizedValue) {
      throw new Error("Agent run metadata keys and values must be non-empty when provided.");
    }
    normalized[normalizedKey] = normalizedValue;
  }

  return Object.freeze(normalized);
}

function normalizeTrigger(trigger: AgentRunRequest["trigger"]): AgentRunTrigger {
  if (!trigger) {
    return Object.freeze({ kind: AgentTriggerKinds.manual });
  }

  if (!Object.values(AgentTriggerKinds).includes(trigger.kind)) {
    throw new Error(`Agent run trigger kind '${String(trigger.kind)}' is not supported.`);
  }

  const invokedBy = trigger.invokedBy?.trim() || undefined;
  const source = trigger.source?.trim() || undefined;
  if (trigger.kind === AgentTriggerKinds.backend && !source) {
    throw new Error("Backend agent run triggers require a non-empty source.");
  }

  return Object.freeze({ kind: trigger.kind, invokedBy, source });
}

export function createAgentRuntimeBinding(params: {
  readonly agent: Agent;
  readonly request: AgentRunRequest;
}): AgentRuntimeBinding {
  const agentId = params.request.agentId.trim();
  if (!agentId) {
    throw new Error("Agent run request agentId is required.");
  }
  if (agentId !== params.agent.id) {
    throw new Error(`Agent run request agentId '${agentId}' must match authored agent '${params.agent.id}'.`);
  }

  const trigger = normalizeTrigger(params.request.trigger);
  const input = normalizeRecord(params.request.input, "input");
  const contextOverrides = normalizeRecord(params.request.contextOverrides, "contextOverrides");
  const overlappingKeys = Object.keys(input).filter((key) => Object.prototype.hasOwnProperty.call(contextOverrides, key));
  if (overlappingKeys.length > 0) {
    throw new Error(`Agent run request input/contextOverrides keys overlap: ${overlappingKeys.join(", ")}.`);
  }

  return Object.freeze({
    agentId,
    persistedConfigurationRevision: params.agent.updatedAt,
    input,
    contextOverrides,
    metadata: normalizeMetadata(params.request.metadata),
    trigger,
  });
}

export function toAgentSessionSummaryReadModel(
  session: AgentExecutionSession,
  composition: AgentSessionSummaryReadModel["composition"],
): AgentSessionSummaryReadModel {
  return Object.freeze({
    sessionId: session.id,
    agentId: session.agentId,
    planId: session.executionPlan?.planId,
    status: session.status,
    terminalReason: session.terminalState?.reason,
    hadPartialProgress: session.terminalState?.hadPartialProgress ?? false,
    completedStepCount: session.terminalState?.completedStepCount ?? 0,
    attemptedStepCount: session.terminalState?.attemptedStepCount ?? 0,
    stepOutcomeCount: session.stepOutcomes.length,
    startedAt: session.startTime,
    endedAt: session.endTime,
    composition,
  });
}

function toOperationalProjection(session: AgentExecutionSession): AgentOperationalProjection {
  const retriedSteps = session.stepOutcomes.filter((outcome) => outcome.attempts > 1).length;
  const totalAttempts = session.stepOutcomes.reduce((acc, outcome) => acc + outcome.attempts, 0);
  const outputAssetIds = session.stepOutcomes
    .map((outcome) => outcome.outputAssetId?.toString())
    .filter((value): value is string => typeof value === "string");

  return Object.freeze({
    executionProgress: Object.freeze({
      completedStepCount: session.terminalState?.completedStepCount ?? 0,
      attemptedStepCount: session.terminalState?.attemptedStepCount ?? session.stepOutcomes.length,
      hadPartialProgress: session.terminalState?.hadPartialProgress ?? false,
    }),
    retrySummary: Object.freeze({
      attemptedSteps: session.stepOutcomes.length,
      totalAttempts,
      retriedSteps,
    }),
    outcomeSummary: Object.freeze({
      completed: session.stepOutcomes.filter((outcome) => outcome.status === "completed").length,
      failed: session.stepOutcomes.filter((outcome) => outcome.status === "failed").length,
      cancelled: session.stepOutcomes.filter((outcome) => outcome.status === "cancelled").length,
      blocked: session.stepOutcomes.filter((outcome) => outcome.status === "blocked").length,
      outputAssetIds: Object.freeze(outputAssetIds),
    }),
    stepOutcomes: Object.freeze(session.stepOutcomes.map((outcome) => Object.freeze({
      stepId: outcome.stepId,
      status: outcome.status,
      attempts: outcome.attempts,
      toolId: outcome.toolId,
      outputAssetId: outcome.outputAssetId?.toString(),
      errorMessage: outcome.errorMessage,
    }))),
    diagnosticSummary: Object.freeze({
      count: session.diagnostics.length,
      assetReferences: Object.freeze(session.diagnostics.map((diagnostic) => Object.freeze({
        assetId: diagnostic.assetId.toString(),
        assetVersionId: diagnostic.assetVersionId,
      }))),
    }),
  });
}

export function toAgentSessionDetailReadModel(input: {
  readonly session: AgentExecutionSession;
  readonly transitions: ReadonlyArray<AgentExecutionSessionTransitionRecord>;
  readonly taxonomy: CompositionTaxonomyDescriptor;
  readonly contract?: AssetContractDescriptor;
}): AgentSessionDetailReadModel {
  const composition = Object.freeze({ taxonomy: input.taxonomy, contract: input.contract });
  return Object.freeze({
    summary: toAgentSessionSummaryReadModel(input.session, composition),
    transitionHistory: Object.freeze([...input.transitions]),
    operational: toOperationalProjection(input.session),
    composition,
  });
}

export function toAgentLaunchReadModel(input: {
  readonly binding: AgentRuntimeBinding;
  readonly result: AgentRunnerResult;
  readonly taxonomy: CompositionTaxonomyDescriptor;
  readonly contract?: AssetContractDescriptor;
}): AgentLaunchReadModel {
  const composition = Object.freeze({ taxonomy: input.taxonomy, contract: input.contract });
  return Object.freeze({
    launch: Object.freeze({
      executionId: input.result.executionId,
      status: input.result.status,
    }),
    binding: input.binding,
    session: toAgentSessionSummaryReadModel(input.result.session, composition),
    operational: Object.freeze({
      ...toOperationalProjection(input.result.session),
      memoryWriteSummary: Object.freeze({
        persistedCount: input.result.memoryWrite.persisted.length,
        skippedCount: input.result.memoryWrite.skipped.length,
        persistedAssetIds: Object.freeze(input.result.memoryWrite.persisted.map((entry) => entry.assetId.toString())),
      }),
    }),
    composition,
  });
}

