import type { AssetContractDescriptor } from "../../domain/contracts/AssetContract";
import type { AssetVersion } from "../../domain/assets/AssetVersion";
import {
  classifyExecutableBehavior,
  type RuntimeBehaviorProfile,
} from "./RuntimeBehaviorAlignment";
import {
  createSystemAsset,
  createSystemStudioTaxonomy,
  type SystemAsset,
  type SystemComponentReference,
  type SystemCompositionReference,
} from "../../domain/system-studio/SystemAssetDomain";
import type { IStudioShellRepository } from "../ports/interfaces/IStudioShellRepository";
import { RuntimeEnvironmentKinds } from "../../domain/system-runtime/RuntimeEnvironmentDomain";
import {
  createExecutionTraceSnapshot,
  type ExecutionContext,
  type ExecutionProgressSnapshot,
  type ExecutionStatusKind,
  type ExecutionTrace,
  type SystemExecution,
} from "../../domain/system-runtime/SystemRuntimeDomain";
import { ExecutionPlanBuilder } from "./ExecutionPlanBuilder";
import { ExecutionOrchestrationService } from "./ExecutionOrchestrationService";
import { mapSystemContractToRuntimeExecutionContract } from "./RuntimeExecutionContractMapping";
import { resolveSystemRuntimeDependencies } from "./RuntimeDependencyResolution";
import { StepExecutionEngine } from "./StepExecutionEngine";
import { CompositionAssetContractResolver } from "../contracts/CompositionAssetContractResolver";

export interface StartSystemRuntimeExecutionRequest {
  readonly studioId?: string;
  readonly draftId?: string;
  readonly versionId?: string;
  readonly executionId?: string;
  readonly context?: ExecutionContext;
  readonly inputPayload?: unknown;
  readonly inputContentType?: string;
  readonly inputSchemaVersion?: string;
  readonly requestedEnvironmentId?: string;
  readonly requestedEnvironmentKind?: keyof typeof RuntimeEnvironmentKinds;
  readonly maxDepth?: number;
  readonly maxIterationsPerNode?: number;
  readonly maxPlanningCyclesPerNode?: number;
}

export interface StartSystemRuntimeExecutionResult {
  readonly execution: SystemExecution;
  readonly runtimeBehavior: RuntimeBehaviorProfile;
}

export interface RuntimeExecutionStatusReadModel {
  readonly executionId: string;
  readonly status: ExecutionStatusKind;
  readonly rootAssetId: string;
  readonly rootVersionId?: string;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly progress: ExecutionProgressSnapshot;
  readonly errorCount: number;
}

export interface RuntimeExecutionResultReadModel {
  readonly executionId: string;
  readonly status: ExecutionStatusKind;
  readonly output?: SystemExecution["output"];
  readonly rootAssetId: string;
  readonly rootVersionId?: string;
  readonly completedAt?: string;
}

export interface RuntimeExecutionTraceReadModel {
  readonly executionId: string;
  readonly trace: ExecutionTrace;
}

interface SystemSpecContent {
  readonly components?: ReadonlyArray<SystemAsset["components"][number]>;
  readonly nestedSystems?: ReadonlyArray<SystemAsset["nestedSystems"][number]>;
  readonly inputs?: ReadonlyArray<SystemAsset["inputs"][number]>;
  readonly outputs?: ReadonlyArray<SystemAsset["outputs"][number]>;
  readonly parameters?: ReadonlyArray<SystemAsset["parameters"][number]>;
  readonly bindings?: ReadonlyArray<SystemAsset["bindings"][number]>;
  readonly executionMetadata?: SystemAsset["executionMetadata"];
}

function trimOrUndefined(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseSystemContent(content: string): SystemSpecContent {
  const raw = content.trim();
  if (!raw) {
    return Object.freeze({});
  }

  const parsed = JSON.parse(raw) as { readonly systemSpec?: SystemSpecContent };
  return Object.freeze(parsed.systemSpec ?? {});
}

function readVersionDraftEnvelope(version: AssetVersion): {
  readonly metadata?: { readonly taxonomy?: SystemAsset["taxonomy"]; readonly provenance?: SystemAsset["provenance"]; readonly contract?: AssetContractDescriptor };
  readonly dependencies?: SystemAsset["dependencies"];
  readonly content?: string;
} {
  const payload = version.metadata as {
    readonly metadata?: unknown;
    readonly dependencies?: unknown;
    readonly content?: unknown;
  } | undefined;
  if (!payload) {
    return Object.freeze({});
  }

  return Object.freeze({
    metadata: payload.metadata as { readonly taxonomy?: SystemAsset["taxonomy"]; readonly provenance?: SystemAsset["provenance"]; readonly contract?: AssetContractDescriptor } | undefined,
    dependencies: Array.isArray(payload.dependencies)
      ? payload.dependencies as SystemAsset["dependencies"]
      : undefined,
    content: typeof payload.content === "string" ? payload.content : undefined,
  });
}

function narrowTrace(trace: ExecutionTrace, eventLimit?: number, logLimit?: number): ExecutionTrace {
  const events = typeof eventLimit === "number" && eventLimit > 0
    ? trace.events.slice(Math.max(0, trace.events.length - eventLimit))
    : trace.events;
  const logs = typeof logLimit === "number" && logLimit > 0
    ? trace.logs.slice(Math.max(0, trace.logs.length - logLimit))
    : trace.logs;

  return Object.freeze({
    events: Object.freeze([...events]),
    logs: Object.freeze([...logs]),
    lastEventAt: trace.lastEventAt,
  });
}

export class SystemRuntimeApplicationService {
  private readonly contractResolver = new CompositionAssetContractResolver();
  private readonly orchestration = new ExecutionOrchestrationService(new StepExecutionEngine(), new ExecutionPlanBuilder());
  private readonly executionsById = new Map<string, SystemExecution>();

  public constructor(
    private readonly repository: IStudioShellRepository,
  ) {}

  public async startExecution(request: StartSystemRuntimeExecutionRequest): Promise<StartSystemRuntimeExecutionResult> {
    const referenceCount = [request.draftId, request.versionId].filter((entry) => Boolean(entry?.trim())).length;
    if (referenceCount !== 1) {
      throw new Error("invalid-request:Exactly one of draftId or versionId is required.");
    }

    const root = request.draftId
      ? await this.loadSystemFromDraft(request.studioId, request.draftId)
      : await this.loadSystemFromVersion(request.versionId!);

    const behavior = classifyExecutableBehavior(root.taxonomy);
    const runtimeContract = await mapSystemContractToRuntimeExecutionContract({
      root,
      contract: await this.resolveRootContract(root),
      resolveSystem: async (reference) => this.resolveSystemFromReference(reference),
      resolveChildContract: async (component) => this.resolveComponentContract(component),
      maxDepth: request.maxDepth,
    });
    const dependencyResolution = await resolveSystemRuntimeDependencies({
      root,
      resolveSystem: async (reference) => this.resolveSystemFromReference(reference),
      maxDepth: request.maxDepth,
    });

    const result = await this.orchestration.orchestrate({
      root,
      runtimeContract,
      dependencyResolution,
      behavior,
      executionId: trimOrUndefined(request.executionId),
      context: request.context,
      inputPayload: request.inputPayload,
      inputContentType: request.inputContentType,
      inputSchemaVersion: request.inputSchemaVersion,
      requestedEnvironmentId: request.requestedEnvironmentId,
      requestedEnvironmentKind: request.requestedEnvironmentKind,
      maxIterationsPerNode: request.maxIterationsPerNode,
      maxPlanningCyclesPerNode: request.maxPlanningCyclesPerNode,
    });

    if (!result.execution) {
      throw new Error(`invalid-request:${result.errors[0] ?? "Unable to create runtime execution."}`);
    }

    this.executionsById.set(result.execution.executionId, result.execution);
    return Object.freeze({ execution: result.execution, runtimeBehavior: behavior });
  }

  public getExecutionStatus(executionId: string): RuntimeExecutionStatusReadModel {
    const execution = this.requireExecution(executionId);
    return Object.freeze({
      executionId: execution.executionId,
      status: execution.status,
      rootAssetId: execution.root.assetId,
      rootVersionId: execution.root.versionId,
      startedAt: execution.startedAt,
      updatedAt: execution.updatedAt,
      completedAt: execution.completedAt,
      progress: execution.runtimeState.snapshot,
      errorCount: execution.runtimeState.errors.length,
    });
  }

  public getExecutionTrace(executionId: string, options?: { readonly eventLimit?: number; readonly logLimit?: number }): RuntimeExecutionTraceReadModel {
    const execution = this.requireExecution(executionId);
    return Object.freeze({
      executionId: execution.executionId,
      trace: narrowTrace(createExecutionTraceSnapshot(execution), options?.eventLimit, options?.logLimit),
    });
  }

  public getExecutionResult(executionId: string): RuntimeExecutionResultReadModel {
    const execution = this.requireExecution(executionId);
    return Object.freeze({
      executionId: execution.executionId,
      status: execution.status,
      output: execution.output,
      rootAssetId: execution.root.assetId,
      rootVersionId: execution.root.versionId,
      completedAt: execution.completedAt,
    });
  }

  private requireExecution(executionId: string): SystemExecution {
    const normalized = executionId.trim();
    if (!normalized) {
      throw new Error("invalid-request:Execution id is required.");
    }

    const execution = this.executionsById.get(normalized);
    if (!execution) {
      throw new Error(`not-found:Execution '${normalized}' was not found.`);
    }

    return execution;
  }

  private async loadSystemFromDraft(studioId: string | undefined, draftId: string): Promise<SystemAsset> {
    const draft = await this.repository.getDraft(draftId.trim());
    if (!draft) {
      throw new Error(`not-found:Draft '${draftId}' was not found.`);
    }
    if (studioId?.trim() && draft.studioId !== studioId.trim()) {
      throw new Error(`invalid-request:Draft '${draftId}' does not belong to studio '${studioId}'.`);
    }

    return createSystemAsset({
      assetId: draft.assetId,
      taxonomy: draft.metadata.taxonomy ?? createSystemStudioTaxonomy(),
      provenance: draft.metadata.provenance,
      dependencies: draft.dependencies,
      ...parseSystemContent(draft.content),
    });
  }

  private async loadSystemFromVersion(versionId: string): Promise<SystemAsset> {
    const version = await this.repository.getAssetVersion(versionId.trim());
    if (!version) {
      throw new Error(`not-found:Version '${versionId}' was not found.`);
    }

    const envelope = readVersionDraftEnvelope(version);
    if (!envelope.content) {
      throw new Error(`invalid-request:Version '${version.versionId}' is missing published system content in metadata.`);
    }

    return createSystemAsset({
      assetId: version.assetId.value,
      versionId: version.versionId,
      taxonomy: envelope.metadata?.taxonomy ?? createSystemStudioTaxonomy(),
      provenance: envelope.metadata?.provenance,
      dependencies: envelope.dependencies ?? [],
      ...parseSystemContent(envelope.content),
    });
  }

  private async resolveSystemFromReference(reference: SystemCompositionReference): Promise<SystemAsset | undefined> {
    if (!reference.versionId) {
      return undefined;
    }

    const version = await this.repository.getAssetVersion(reference.versionId);
    if (!version || version.assetId.value !== reference.assetId) {
      return undefined;
    }

    const envelope = readVersionDraftEnvelope(version);
    if (!envelope.content) {
      return undefined;
    }

    return createSystemAsset({
      assetId: version.assetId.value,
      versionId: version.versionId,
      taxonomy: envelope.metadata?.taxonomy ?? createSystemStudioTaxonomy(),
      provenance: envelope.metadata?.provenance,
      dependencies: envelope.dependencies ?? [],
      ...parseSystemContent(envelope.content),
    });
  }

  private async resolveRootContract(root: SystemAsset): Promise<AssetContractDescriptor> {
    const resolved = await this.contractResolver.resolveSystemContract({
      root,
      resolveSystem: (reference) => this.resolveSystemFromReference(reference),
      resolveChildContract: (component) => this.resolveComponentContract(component),
      maxDepth: 4,
    });
    return resolved;
  }

  private async resolveComponentContract(component: SystemComponentReference): Promise<AssetContractDescriptor | undefined> {
    if (component.versionId) {
      const version = await this.repository.getAssetVersion(component.versionId);
      const envelope = version ? readVersionDraftEnvelope(version) : undefined;
      const contract = envelope?.metadata?.contract;
      if (contract) {
        return contract;
      }
    }

    if (!component.taxonomy) {
      return undefined;
    }

    return this.contractResolver.resolveContractForTaxonomy(component.taxonomy);
  }
}
