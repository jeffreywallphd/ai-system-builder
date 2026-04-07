import type { Agent } from "../../../domain/agents/Agent";
import type { AgentMemoryEntryReference, AgentMemoryStore, AgentMemoryType } from "../../../domain/agents/AgentMemory";
import type { AgentPlan } from "../../../domain/agents/AgentPlan";
import type { AgentWorkingMemory } from "../../../domain/agents/AgentWorkingMemory";

export interface AgentMemoryWriteCandidate {
  readonly memoryType: AgentMemoryType;
  readonly tags?: ReadonlyArray<string>;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
  readonly assetId?: AgentMemoryEntryReference["assetId"];
  readonly assetVersionId?: string;
}

export interface AgentMemoryWriteResult {
  readonly persisted: ReadonlyArray<AgentMemoryEntryReference>;
  readonly skipped: ReadonlyArray<{ readonly reason: string; readonly candidate: AgentMemoryWriteCandidate }>;
}

export interface AgentExecutionMemoryWriteInput {
  readonly agentId: string;
  readonly executionId: string;
  readonly planId: string;
  readonly status: "completed" | "failed" | "cancelled";
  readonly outcomes: ReadonlyArray<{
    readonly stepId: string;
    readonly status: "completed" | "failed" | "cancelled";
    readonly output?: string;
    readonly errorMessage?: string;
    readonly outputAssetId?: AgentMemoryEntryReference["assetId"];
  }>;
  readonly finalOutput?: string;
  readonly workingMemory: AgentWorkingMemory;
}

function normalizePrimitiveMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, string | number | boolean | null>> | undefined {
  if (!metadata) {
    return undefined;
  }
  return Object.freeze(
    Object.fromEntries(
      Object.entries(metadata).flatMap(([key, value]) => {
        if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          return [[key, value] as const];
        }
        return [];
      }),
    ),
  );
}

export class AgentMemoryWriteService {
  constructor(private readonly memoryStore: AgentMemoryStore) {}

  public async writeEntries(agent: Agent, candidates: ReadonlyArray<AgentMemoryWriteCandidate>): Promise<AgentMemoryWriteResult> {
    const persisted: AgentMemoryEntryReference[] = [];
    const skipped: Array<{ reason: string; candidate: AgentMemoryWriteCandidate }> = [];
    const writable = new Set(agent.memory.policy.writableTypes);
    const sessionOnly = new Set(agent.memory.policy.sessionOnlyTypes);
    const durableTypes = (agent.memory.policy.writableTypes ?? []).filter((type) => !sessionOnly.has(type));
    const retentionLimit = agent.memory.policy.retention.mode === "bounded"
      ? agent.memory.policy.retention.maxDurableEntries
      : undefined;
    let remainingDurableCapacity = Number.POSITIVE_INFINITY;
    if (retentionLimit !== undefined) {
      const existing = await this.memoryStore.query(agent.id, {
        assetIds: agent.memory.assets.map((entry) => entry.assetId),
        memoryTypes: durableTypes.length > 0 ? durableTypes : undefined,
        maxEntries: retentionLimit,
      });
      remainingDurableCapacity = Math.max(0, retentionLimit - existing.length);
    }

    for (const candidate of candidates) {
      if (writable.size > 0 && !writable.has(candidate.memoryType)) {
        skipped.push({ reason: `memory-type-not-writable:${candidate.memoryType}`, candidate });
        continue;
      }
      if (sessionOnly.has(candidate.memoryType)) {
        skipped.push({ reason: `session-only-memory-type:${candidate.memoryType}`, candidate });
        continue;
      }
      if (remainingDurableCapacity <= 0) {
        skipped.push({ reason: "retention-cap-reached", candidate });
        continue;
      }

      const fallbackAsset = agent.memory.assets.find((entry) => entry.memoryType === candidate.memoryType)?.assetId
        ?? agent.memory.assets[0]?.assetId;
      if (!fallbackAsset && !candidate.assetId) {
        skipped.push({ reason: "missing-memory-asset", candidate });
        continue;
      }

      const entry: AgentMemoryEntryReference = Object.freeze({
        assetId: candidate.assetId ?? fallbackAsset!,
        assetVersionId: candidate.assetVersionId,
        memoryType: candidate.memoryType,
        tags: Object.freeze((candidate.tags ?? []).map((tag) => tag.trim()).filter(Boolean)),
        metadata: normalizePrimitiveMetadata(candidate.metadata),
      });

      await this.memoryStore.add(agent.id, entry);
      persisted.push(entry);
      remainingDurableCapacity -= 1;
    }

    return Object.freeze({ persisted: Object.freeze(persisted), skipped: Object.freeze(skipped) });
  }

  public async writeExecutionOutcome(agent: Agent, plan: AgentPlan, execution: AgentExecutionMemoryWriteInput): Promise<AgentMemoryWriteResult> {
    const candidate: AgentMemoryWriteCandidate = {
      memoryType: "episodic",
      tags: ["agent-execution", execution.status],
      metadata: {
        planId: plan.planId,
        strategyId: plan.strategyId,
        status: execution.status,
        stepCount: execution.outcomes.length,
        finalOutput: execution.finalOutput ?? null,
        executionId: execution.executionId,
        workingMemorySessionId: execution.workingMemory.sessionId,
        workingMemoryEntries: execution.workingMemory.retrievedMemory.length,
      },
    };
    return this.writeEntries(agent, [candidate]);
  }
}
