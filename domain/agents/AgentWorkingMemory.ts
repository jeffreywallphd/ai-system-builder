import { AssetId } from "../assets/AssetId";
import type { AgentMemoryEntryReference } from "./AgentMemory";

export interface AgentWorkingMemoryExecutionOutput {
  readonly stepId: string;
  readonly outputAssetId?: AssetId;
  readonly status: "completed" | "failed" | "cancelled";
  readonly summary?: string;
}

export interface AgentWorkingMemory {
  readonly sessionId: string;
  readonly agentId: string;
  readonly planId?: string;
  readonly retrievedMemory: ReadonlyArray<AgentMemoryEntryReference>;
  readonly executionOutputs: ReadonlyArray<AgentWorkingMemoryExecutionOutput>;
  readonly planAssetReferences: ReadonlyArray<AssetId>;
  readonly maxEntries: number;
  readonly updatedAt: string;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeAssetId(value: AssetId): AssetId {
  const normalized = AssetId.from(value);
  if (!normalized.toString().startsWith("asset:")) {
    throw new Error(`Agent working memory assetId '${normalized.toString()}' must use canonical asset id format.`);
  }
  return normalized;
}

function normalizeMemoryEntries(entries: ReadonlyArray<AgentMemoryEntryReference>): ReadonlyArray<AgentMemoryEntryReference> {
  const deduped = new Set<string>();
  const normalized: AgentMemoryEntryReference[] = [];
  for (const entry of entries) {
    const assetId = normalizeAssetId(entry.assetId);
    const key = `${assetId.toString()}|${entry.assetVersionId ?? "latest"}|${entry.memoryType}`;
    if (deduped.has(key)) {
      continue;
    }
    deduped.add(key);
    normalized.push(Object.freeze({
      ...entry,
      assetId,
      tags: Object.freeze((entry.tags ?? []).map((tag) => tag.trim()).filter(Boolean)),
      metadata: entry.metadata ? Object.freeze({ ...entry.metadata }) : undefined,
    }));
  }
  return Object.freeze(normalized);
}

function normalizeExecutionOutputs(
  outputs: ReadonlyArray<AgentWorkingMemoryExecutionOutput>,
): ReadonlyArray<AgentWorkingMemoryExecutionOutput> {
  const seen = new Set<string>();
  const normalized: AgentWorkingMemoryExecutionOutput[] = [];
  for (const output of outputs) {
    const stepId = normalizeRequired(output.stepId, "Agent working memory execution output stepId");
    if (seen.has(stepId)) {
      continue;
    }
    seen.add(stepId);
    normalized.push(Object.freeze({
      stepId,
      status: output.status,
      outputAssetId: output.outputAssetId ? normalizeAssetId(output.outputAssetId) : undefined,
      summary: output.summary?.trim() || undefined,
    }));
  }
  return Object.freeze(normalized);
}

export function createAgentWorkingMemory(input: {
  readonly sessionId: string;
  readonly agentId: string;
  readonly planId?: string;
  readonly retrievedMemory?: ReadonlyArray<AgentMemoryEntryReference>;
  readonly executionOutputs?: ReadonlyArray<AgentWorkingMemoryExecutionOutput>;
  readonly planAssetReferences?: ReadonlyArray<AssetId>;
  readonly maxEntries?: number;
  readonly now?: Date;
}): AgentWorkingMemory {
  const maxEntries = input.maxEntries ?? 20;
  if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
    throw new Error("Agent working memory maxEntries must be a positive integer.");
  }

  const retrievedMemory = normalizeMemoryEntries(input.retrievedMemory ?? []).slice(0, maxEntries);
  const executionOutputs = normalizeExecutionOutputs(input.executionOutputs ?? []).slice(0, maxEntries);
  const planAssetReferences = Object.freeze(
    [...new Set((input.planAssetReferences ?? []).map((entry) => normalizeAssetId(entry).toString()))]
      .slice(0, maxEntries)
      .map((entry) => new AssetId(entry)),
  );

  return Object.freeze({
    sessionId: normalizeRequired(input.sessionId, "Agent working memory sessionId"),
    agentId: normalizeRequired(input.agentId, "Agent working memory agentId"),
    planId: input.planId?.trim() || undefined,
    retrievedMemory: Object.freeze(retrievedMemory),
    executionOutputs: Object.freeze(executionOutputs),
    planAssetReferences,
    maxEntries,
    updatedAt: (input.now ?? new Date()).toISOString(),
  });
}

export function updateAgentWorkingMemory(
  state: AgentWorkingMemory,
  update: {
    readonly appendRetrievedMemory?: ReadonlyArray<AgentMemoryEntryReference>;
    readonly appendExecutionOutputs?: ReadonlyArray<AgentWorkingMemoryExecutionOutput>;
    readonly appendPlanAssetReferences?: ReadonlyArray<AssetId>;
    readonly now?: Date;
  },
): AgentWorkingMemory {
  return createAgentWorkingMemory({
    sessionId: state.sessionId,
    agentId: state.agentId,
    planId: state.planId,
    maxEntries: state.maxEntries,
    retrievedMemory: [...state.retrievedMemory, ...(update.appendRetrievedMemory ?? [])],
    executionOutputs: [...state.executionOutputs, ...(update.appendExecutionOutputs ?? [])],
    planAssetReferences: [...state.planAssetReferences, ...(update.appendPlanAssetReferences ?? [])],
    now: update.now,
  });
}
