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
import type { RuntimeEnvironment } from "../../domain/system-runtime/RuntimeEnvironmentDomain";
import {
  ExecutionEnvironmentConfigurationValidator,
  type ExternalExecutionEnvironmentRequest,
} from "./ExecutionEnvironmentConfigurationValidator";
import type { ExecutionTenantContext } from "./TenantExecutionIsolationPolicy";
import {
  createExecutionTraceSnapshot,
  ExecutionLogLevels,
  ExecutionNodeStatusKinds,
  ExecutionStatusKinds,
  ExecutionTraceEventKinds,
  type ExecutionContext,
  type ExecutionProgressSnapshot,
  type ExecutionStatusKind,
  type ExecutionTrace,
  type SystemExecution,
} from "../../domain/system-runtime/SystemRuntimeDomain";
import { ExecutionPlanBuilder } from "./ExecutionPlanBuilder";
import { ExecutionOrchestrationService } from "./ExecutionOrchestrationService";
import type { StepExecutionResult } from "./StepExecutionEngine";
import { mapSystemContractToRuntimeExecutionContract } from "./RuntimeExecutionContractMapping";
import { resolveSystemRuntimeDependencies } from "./RuntimeDependencyResolution";
import { StepExecutionEngine } from "./StepExecutionEngine";
import { CompositionAssetContractResolver } from "../contracts/CompositionAssetContractResolver";
import {
  RuntimeInputValidationFailure,
  RuntimeInputValidationService,
} from "./RuntimeInputValidationService";
import {
  InMemorySystemRuntimeExecutionStore,
  type ExecutionMetadataSnapshot,
  type ISystemRuntimeExecutionStore,
  type PersistedExecutionRecord,
} from "./SystemRuntimeExecutionStore";
import { parsePersistedRuntimeCapabilityBindingEnvelope } from "./RuntimeCapabilityBindingPersistence";
import { parseSystemSerializationDocument } from "../../domain/system-studio/SystemSerializationContract";
import {
  SerializedAssetReferenceResolutionIssueCodes,
  SerializedAssetReferenceResolutionService,
} from "./SerializedAssetReferenceResolutionService";
import { requiresPinnedRuntimeComponentVersion } from "./RuntimeComponentVersionPinningPolicy";

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
  readonly requestedEnvironment?: ExternalExecutionEnvironmentRequest;
  readonly tenantContext?: ExecutionTenantContext;
  readonly maxDepth?: number;
  readonly maxIterationsPerNode?: number;
  readonly maxPlanningCyclesPerNode?: number;
  readonly maxTraceEvents?: number;
  readonly maxTraceLogs?: number;
  readonly maxRuntimeErrors?: number;
  readonly maxProgressionEntries?: number;
  readonly componentVersionPins?: Readonly<Record<string, string>>;
  readonly enforceVersionPinning?: boolean;
}

export interface StartSystemRuntimeExecutionResult {
  readonly execution: SystemExecution;
  readonly runtimeBehavior: RuntimeBehaviorProfile;
  readonly executionEnvironment?: RuntimeEnvironment;
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
  readonly nodeStatuses: ReadonlyArray<{
    readonly nodeId: string;
    readonly parentNodeId?: string;
    readonly path: ReadonlyArray<string>;
    readonly structuralKind: SystemExecution["nodes"][number]["target"]["taxonomy"]["structuralKind"];
    readonly semanticRole: SystemExecution["nodes"][number]["target"]["taxonomy"]["semanticRole"];
    readonly behaviorKind: SystemExecution["nodes"][number]["target"]["taxonomy"]["behaviorKind"];
    readonly status: SystemExecution["runtimeState"]["nodeStates"][number]["status"];
    readonly iterationCount: number;
    readonly planningCycleCount: number;
    readonly startedAt?: string;
    readonly updatedAt: string;
    readonly completedAt?: string;
    readonly lastError?: {
      readonly code: string;
      readonly message: string;
    };
    readonly lastDecision?: {
      readonly kind: string;
      readonly reason?: string;
      readonly decidedAt: string;
    };
  }>;
  readonly nestedSystems: ReadonlyArray<{
    readonly nodeId: string;
    readonly status: SystemExecution["runtimeState"]["nodeStates"][number]["status"];
    readonly path: ReadonlyArray<string>;
    readonly parentNodeId?: string;
  }>;
  readonly recovery: {
    readonly decisionCount: number;
    readonly retryDecisionCount: number;
    readonly lastDecisionAt?: string;
  };
  readonly executedVersionMap: {
    readonly rootVersionId?: string;
    readonly nodeVersionIds: Readonly<Record<string, string>>;
  };
  readonly nestedExecutionLineage: ReadonlyArray<{
    readonly executionId: string;
    readonly parentExecutionId?: string;
    readonly parentNodeId?: string;
    readonly rootAssetId: string;
    readonly rootVersionId?: string;
    readonly status: ExecutionStatusKind;
    readonly startedAt: string;
    readonly completedAt?: string;
  }>;
}

export interface RuntimeExecutionResultReadModel {
  readonly executionId: string;
  readonly status: ExecutionStatusKind;
  readonly output?: SystemExecution["output"];
  readonly rootAssetId: string;
  readonly rootVersionId?: string;
  readonly completedAt?: string;
  readonly outputSummary: {
    readonly hasOutput: boolean;
    readonly hasError: boolean;
    readonly outputFieldCount: number;
    readonly contractOutputIds: ReadonlyArray<string>;
  };
  readonly nodeResults: ReadonlyArray<{
    readonly nodeId: string;
    readonly path: ReadonlyArray<string>;
    readonly structuralKind: SystemExecution["nodes"][number]["target"]["taxonomy"]["structuralKind"];
    readonly semanticRole: SystemExecution["nodes"][number]["target"]["taxonomy"]["semanticRole"];
    readonly status: SystemExecution["runtimeState"]["nodeStates"][number]["status"];
    readonly outputSummary?: string;
    readonly hasOutput: boolean;
    readonly hasError: boolean;
  }>;
  readonly nestedSystemResults: ReadonlyArray<{
    readonly nodeId: string;
    readonly status: SystemExecution["runtimeState"]["nodeStates"][number]["status"];
    readonly outputSummary?: string;
    readonly path: ReadonlyArray<string>;
  }>;
  readonly diagnostics: ReadonlyArray<{
    readonly source: "output" | "runtime-error" | "trace-log";
    readonly severity: "info" | "warning" | "error";
    readonly code?: string;
    readonly message: string;
    readonly nodeId?: string;
    readonly at?: string;
  }>;
  readonly executedVersionMap: {
    readonly rootVersionId?: string;
    readonly nodeVersionIds: Readonly<Record<string, string>>;
  };
  readonly nestedExecutionLineage: ReadonlyArray<{
    readonly executionId: string;
    readonly parentExecutionId?: string;
    readonly parentNodeId?: string;
    readonly rootAssetId: string;
    readonly rootVersionId?: string;
    readonly status: ExecutionStatusKind;
    readonly startedAt: string;
    readonly completedAt?: string;
  }>;
  readonly runtimeCapability?: {
    readonly bindingId: string;
    readonly providerId: string;
    readonly profileId: string;
    readonly selectedModelBindingId: string;
    readonly resolvedAt?: string;
    readonly resolverVersion?: string;
    readonly stale: boolean;
  };
}

export interface RuntimeExecutionTraceReadModel {
  readonly executionId: string;
  readonly trace: ExecutionTrace;
}

export interface RuntimeExecutionSummaryReadModel {
  readonly executionId: string;
  readonly status: SystemExecution["status"];
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly rootVersionId?: string;
  readonly result: "succeeded" | "failed" | "cancelled" | "running";
  readonly traceEventCount: number;
  readonly traceLogCount: number;
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

type RuntimeCapabilityExecutionTrace = NonNullable<ExecutionMetadataSnapshot["runtimeCapability"]>;

function trimOrUndefined(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseSystemContent(content: string): SystemSpecContent {
  const parsed = parseSystemSerializationDocument({ content });
  return Object.freeze(parsed.systemSpec);
}

function resolveRuntimeCapabilityTrace(root: SystemAsset): RuntimeCapabilityExecutionTrace | undefined {
  const envelope = root.executionMetadata?.runtimeCapabilityBindings;
  if (!envelope) {
    return undefined;
  }
  const parsed = parsePersistedRuntimeCapabilityBindingEnvelope(envelope);
  const selected = parsed?.bindings[0];
  if (!selected) {
    return undefined;
  }
  return Object.freeze({
    bindingId: selected.bindingContract.bindingId,
    providerId: selected.bindingContract.executionProvider.providerId,
    profileId: selected.bindingContract.workflowExecutionProfile.profileId,
    selectedModelBindingId: selected.selectedModelBindingId,
    resolvedAt: selected.resolved?.resolvedAt,
    resolverVersion: selected.resolved?.resolverVersion,
    stale: !selected.resolved,
  });
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

function summarizeOutput(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string") {
    return value.length > 160 ? `${value.slice(0, 157)}...` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return `${value}`;
  }
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  if (typeof value === "object") {
    return `Object(${Object.keys(value as Record<string, unknown>).length} fields)`;
  }
  return undefined;
}

function normalizeOptionalBoundedInteger(input: {
  readonly value: number | undefined;
  readonly label: string;
  readonly min: number;
  readonly max: number;
}): number | undefined {
  if (input.value === undefined) {
    return undefined;
  }
  if (!Number.isFinite(input.value) || Math.floor(input.value) !== input.value) {
    throw new Error(`invalid-request:${input.label} must be an integer.`);
  }
  if (input.value < input.min || input.value > input.max) {
    throw new Error(`invalid-request:${input.label} must be between ${input.min} and ${input.max}.`);
  }
  return input.value;
}

export class SystemRuntimeApplicationService {
  private readonly contractResolver = new CompositionAssetContractResolver();
  private readonly orchestration = new ExecutionOrchestrationService(new StepExecutionEngine(), new ExecutionPlanBuilder());
  private readonly runtimeInputValidation = new RuntimeInputValidationService();
  private readonly environmentConfigurationValidator = new ExecutionEnvironmentConfigurationValidator();
  private readonly serializedReferenceResolver: SerializedAssetReferenceResolutionService;

  public constructor(
    private readonly repository: IStudioShellRepository,
    private readonly executionStore: ISystemRuntimeExecutionStore = new InMemorySystemRuntimeExecutionStore(),
  ) {
    this.serializedReferenceResolver = new SerializedAssetReferenceResolutionService(repository);
  }

  public async startExecution(request: StartSystemRuntimeExecutionRequest): Promise<StartSystemRuntimeExecutionResult> {
    const referenceCount = [request.draftId, request.versionId].filter((entry) => Boolean(entry?.trim())).length;
    if (referenceCount !== 1) {
      throw new Error("invalid-request:Exactly one of draftId or versionId is required.");
    }

    const maxDepth = normalizeOptionalBoundedInteger({ value: request.maxDepth, label: "maxDepth", min: 1, max: 12 });
    const maxIterationsPerNode = normalizeOptionalBoundedInteger({
      value: request.maxIterationsPerNode,
      label: "maxIterationsPerNode",
      min: 1,
      max: 25,
    });
    const maxPlanningCyclesPerNode = normalizeOptionalBoundedInteger({
      value: request.maxPlanningCyclesPerNode,
      label: "maxPlanningCyclesPerNode",
      min: 1,
      max: 25,
    });
    const maxTraceEvents = normalizeOptionalBoundedInteger({ value: request.maxTraceEvents, label: "maxTraceEvents", min: 10, max: 4000 });
    const maxTraceLogs = normalizeOptionalBoundedInteger({ value: request.maxTraceLogs, label: "maxTraceLogs", min: 10, max: 4000 });
    const maxRuntimeErrors = normalizeOptionalBoundedInteger({ value: request.maxRuntimeErrors, label: "maxRuntimeErrors", min: 1, max: 1000 });
    const maxProgressionEntries = normalizeOptionalBoundedInteger({
      value: request.maxProgressionEntries,
      label: "maxProgressionEntries",
      min: 10,
      max: 4000,
    });

    const unresolvedRoot = request.draftId
      ? await this.loadSystemFromDraft(request.studioId, request.draftId)
      : await this.loadSystemFromVersion(request.versionId!);
    const root = this.applyVersionPins(unresolvedRoot, request.componentVersionPins);
    this.assertVersionPinnedExecution({
      root,
      enforceVersionPinning: request.enforceVersionPinning ?? true,
    });

    const behavior = classifyExecutableBehavior(root.taxonomy);
    const rootContract = await this.resolveRootContract(root);
    const runtimeContract = await mapSystemContractToRuntimeExecutionContract({
      root,
      contract: rootContract,
      resolveSystem: async (reference) => this.resolveSystemFromReference(reference),
      resolveChildContract: async (component) => this.resolveComponentContract(component),
      maxDepth,
    });
    const inputValidation = this.runtimeInputValidation.validate({
      inputPayload: request.inputPayload,
      runtimeContract,
      contract: rootContract,
    });
    if (!inputValidation.valid) {
      throw new RuntimeInputValidationFailure(inputValidation.errors);
    }
    const dependencyResolution = await resolveSystemRuntimeDependencies({
      root,
      resolveSystem: async (reference) => this.resolveSystemFromReference(reference),
      maxDepth,
    });

    const environmentConfiguration = this.environmentConfigurationValidator.validate(request.requestedEnvironment);
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
      requestedEnvironmentId: environmentConfiguration.requestedEnvironmentId ?? request.requestedEnvironmentId,
      requestedEnvironmentKind: environmentConfiguration.requestedEnvironmentKind ?? request.requestedEnvironmentKind,
      requireNestedSystems: environmentConfiguration.requireNestedSystems,
      requireMcpMediatedExecution: environmentConfiguration.requireMcpMediatedExecution,
      maxIterationsPerNode,
      maxPlanningCyclesPerNode,
      maxTraceEvents,
      maxTraceLogs,
      maxRuntimeErrors,
      maxProgressionEntries,
      executeNestedSystemStep: async (input) => this.executeNestedSystemStep({
        ...input,
        rootRequest: request,
      }),
    });

    if (!result.execution) {
      throw new Error(`invalid-request:${result.errors[0] ?? "Unable to create runtime execution."}`);
    }

    const runtimeCapabilityTrace = resolveRuntimeCapabilityTrace(root);
    const normalizedExecution: SystemExecution = result.execution.output
      ? Object.freeze({
        ...result.execution,
        output: Object.freeze({
          ...result.execution.output,
          payload: Object.freeze({
            ...(result.execution.output.payload && typeof result.execution.output.payload === "object"
              ? result.execution.output.payload as Record<string, unknown>
              : {}),
            contractOutputs: runtimeContract.outputs.map((entry) => entry.id),
            runtimeCapability: runtimeCapabilityTrace,
          }),
        }),
      })
      : result.execution;

    const executionWithTenant: SystemExecution = request.tenantContext?.tenantId
      ? Object.freeze({
        ...normalizedExecution,
        context: Object.freeze({
          ...normalizedExecution.context,
          metadata: Object.freeze({
            ...(normalizedExecution.context.metadata ?? {}),
            tenantId: request.tenantContext.tenantId,
            runtimeCapability: runtimeCapabilityTrace,
          }),
        }),
      })
      : Object.freeze({
        ...normalizedExecution,
        context: Object.freeze({
          ...normalizedExecution.context,
          metadata: Object.freeze({
            ...(normalizedExecution.context.metadata ?? {}),
            runtimeCapability: runtimeCapabilityTrace,
          }),
        }),
      });

    this.executionStore.saveExecutionRecord(this.createExecutionRecord(executionWithTenant));
    return Object.freeze({
      execution: executionWithTenant,
      runtimeBehavior: behavior,
      executionEnvironment: result.plan?.environment,
    });
  }

  public getExecutionStatus(executionId: string): RuntimeExecutionStatusReadModel {
    const execution = this.requireExecution(executionId);
    const nodeStateById = new Map(execution.runtimeState.nodeStates.map((entry) => [entry.executionNodeId, entry] as const));
    const nodeStatuses = Object.freeze(execution.nodes
      .map((node) => {
        const state = nodeStateById.get(node.executionNodeId);
        if (!state) {
          return undefined;
        }
        return Object.freeze({
          nodeId: node.executionNodeId,
          parentNodeId: node.parentExecutionNodeId,
          path: node.path,
          structuralKind: node.target.taxonomy.structuralKind,
          semanticRole: node.target.taxonomy.semanticRole,
          behaviorKind: node.target.taxonomy.behaviorKind,
          status: state.status,
          iterationCount: state.iterationCount,
          planningCycleCount: state.planningCycleCount,
          startedAt: state.startedAt,
          updatedAt: state.updatedAt,
          completedAt: state.completedAt,
          lastError: state.lastError,
          lastDecision: state.lastDecision,
        });
      })
      .filter((entry): entry is NonNullable<typeof entry> => !!entry)
      .sort((left, right) => left.nodeId.localeCompare(right.nodeId)));

    const recoveryEvents = execution.runtimeState.trace.events.filter((entry) => entry.kind === ExecutionTraceEventKinds.recoveryDecided);
    const recovery = Object.freeze({
      decisionCount: recoveryEvents.length,
      retryDecisionCount: recoveryEvents.filter((entry) => entry.summary?.includes("Retrying")).length,
      lastDecisionAt: recoveryEvents.length > 0 ? recoveryEvents[recoveryEvents.length - 1]!.at : undefined,
    });

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
      nodeStatuses,
      nestedSystems: Object.freeze(nodeStatuses
        .filter((entry) => entry.structuralKind === "system")
        .map((entry) => Object.freeze({
          nodeId: entry.nodeId,
          status: entry.status,
          path: entry.path,
          parentNodeId: entry.parentNodeId,
        }))),
      recovery,
      executedVersionMap: Object.freeze({
        rootVersionId: execution.root.versionId,
        nodeVersionIds: this.buildNodeVersionMap(execution),
      }),
      nestedExecutionLineage: this.buildNestedExecutionLineage(execution.executionId),
      runtimeCapability: this.readRuntimeCapabilityTrace(execution),
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
    const nodeStateById = new Map(execution.runtimeState.nodeStates.map((entry) => [entry.executionNodeId, entry] as const));
    const outputPayload = execution.output?.payload as {
      readonly nodeResults?: Record<string, unknown>;
      readonly contractOutputs?: ReadonlyArray<string>;
    } | undefined;
    const nodeResults = outputPayload?.nodeResults ?? {};
    const nodeOutputIds = Object.keys(nodeResults);
    const diagnostics = Object.freeze([
      ...(execution.output?.error ? [Object.freeze({
        source: "output" as const,
        severity: "error" as const,
        code: execution.output.error.code,
        message: execution.output.error.message,
      })] : []),
      ...execution.runtimeState.errors.map((error) => Object.freeze({
        source: "runtime-error" as const,
        severity: "error" as const,
        code: error.code,
        message: error.message,
        nodeId: error.nodeId,
        at: error.at,
      })),
      ...execution.runtimeState.trace.logs
        .filter((entry) => entry.level !== ExecutionLogLevels.info)
        .map((entry) => Object.freeze({
          source: "trace-log" as const,
          severity: entry.level,
          message: entry.message,
          nodeId: entry.nodeId,
          at: entry.emittedAt,
        })),
    ]);

    const projectedNodeResults = Object.freeze(execution.nodes
      .map((node) => {
        const state = nodeStateById.get(node.executionNodeId);
        if (!state) {
          return undefined;
        }
        const nodeOutput = nodeResults[node.executionNodeId];
        return Object.freeze({
          nodeId: node.executionNodeId,
          path: node.path,
          structuralKind: node.target.taxonomy.structuralKind,
          semanticRole: node.target.taxonomy.semanticRole,
          status: state.status,
          outputSummary: summarizeOutput(nodeOutput),
          hasOutput: nodeOutput !== undefined,
          hasError: state.status === ExecutionNodeStatusKinds.failed || state.status === ExecutionNodeStatusKinds.cancelled,
        });
      })
      .filter((entry): entry is NonNullable<typeof entry> => !!entry)
      .sort((left, right) => left.nodeId.localeCompare(right.nodeId)));

    return Object.freeze({
      executionId: execution.executionId,
      status: execution.status,
      output: execution.output,
      rootAssetId: execution.root.assetId,
      rootVersionId: execution.root.versionId,
      completedAt: execution.completedAt,
      outputSummary: Object.freeze({
        hasOutput: Boolean(execution.output),
        hasError: Boolean(execution.output?.error) || execution.status === ExecutionStatusKinds.failed,
        outputFieldCount: nodeOutputIds.length,
        contractOutputIds: Object.freeze([...(outputPayload?.contractOutputs ?? [])]),
      }),
      nodeResults: projectedNodeResults,
      nestedSystemResults: Object.freeze(projectedNodeResults
        .filter((entry) => entry.structuralKind === "system")
        .map((entry) => Object.freeze({
          nodeId: entry.nodeId,
          status: entry.status,
          outputSummary: entry.outputSummary,
          path: entry.path,
        }))),
      diagnostics,
      executedVersionMap: Object.freeze({
        rootVersionId: execution.root.versionId,
        nodeVersionIds: this.buildNodeVersionMap(execution),
      }),
      nestedExecutionLineage: this.buildNestedExecutionLineage(execution.executionId),
      runtimeCapability: this.readRuntimeCapabilityTrace(execution),
    });
  }

  public getExecutionTenantId(executionId: string): string | undefined {
    const execution = this.requireExecution(executionId);
    const tenantId = execution.context.metadata?.tenantId;
    return typeof tenantId === "string" ? tenantId : undefined;
  }

  private requireExecution(executionId: string): SystemExecution {
    const normalized = executionId.trim();
    if (!normalized) {
      throw new Error("invalid-request:Execution id is required.");
    }

    const execution = this.executionStore.getExecutionRecord(normalized)?.execution;
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

    const parsedDocument = parseSystemSerializationDocument({
      content: envelope.content,
      dependencies: envelope.dependencies ?? [],
    });
    await this.assertSerializedReferencesResolvable(parsedDocument);

    return createSystemAsset({
      assetId: version.assetId.value,
      versionId: version.versionId,
      taxonomy: envelope.metadata?.taxonomy ?? createSystemStudioTaxonomy(),
      provenance: envelope.metadata?.provenance,
      dependencies: envelope.dependencies ?? [],
      ...parsedDocument.systemSpec,
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

    const parsedDocument = parseSystemSerializationDocument({
      content: envelope.content,
      dependencies: envelope.dependencies ?? [],
    });
    await this.assertSerializedReferencesResolvable(parsedDocument);

    return createSystemAsset({
      assetId: version.assetId.value,
      versionId: version.versionId,
      taxonomy: envelope.metadata?.taxonomy ?? createSystemStudioTaxonomy(),
      provenance: envelope.metadata?.provenance,
      dependencies: envelope.dependencies ?? [],
      ...parsedDocument.systemSpec,
    });
  }

  private async assertSerializedReferencesResolvable(
    document: ReturnType<typeof parseSystemSerializationDocument>,
  ): Promise<void> {
    const resolution = await this.serializedReferenceResolver.resolveReferences({
      serializedSchemaVersion: document.schemaVersion,
      references: [
        ...document.contract?.assetReferences.datasets ?? [],
        ...document.contract?.assetReferences.workflows ?? [],
        ...document.contract?.runtime.workflowBindings.map((entry) => Object.freeze({
          kind: "workflow" as const,
          assetId: entry.workflowAssetId,
          versionId: entry.workflowVersionId,
          alias: entry.componentAlias,
          metadata: { bindingId: entry.bindingId, pinMode: entry.pinMode },
        })) ?? [],
      ],
    });
    if (resolution.ok) {
      return;
    }

    const unsupported = resolution.issues.find((issue) => issue.code === SerializedAssetReferenceResolutionIssueCodes.unsupportedSerializedVersion);
    if (unsupported) {
      throw new Error(`invalid-request:${unsupported.code}:${unsupported.message}`);
    }

    const blockingIssue = resolution.issues.find((entry) => (
      entry.code === SerializedAssetReferenceResolutionIssueCodes.invalidReference
      || entry.code === SerializedAssetReferenceResolutionIssueCodes.incompatibleVersion
      || (entry.code === SerializedAssetReferenceResolutionIssueCodes.missingAsset && Boolean(entry.reference.versionId))
    ));
    if (!blockingIssue) {
      const unpinnedWorkflow = document.contract?.runtime.workflowBindings.find((entry) => !entry.workflowVersionId);
      if (!unpinnedWorkflow) {
        return;
      }
      throw new Error(
        `invalid-request:serialized-reference-unresolved-workflow-version:Workflow binding '${unpinnedWorkflow.bindingId}' is missing workflowVersionId.`,
      );
    }
    throw new Error(`invalid-request:serialized-reference-${blockingIssue.code}:${blockingIssue.message}`);
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

  public listRecentExecutionsForSystem(input: {
    readonly assetId: string;
    readonly versionId?: string;
    readonly limit?: number;
  }): ReadonlyArray<RuntimeExecutionSummaryReadModel> {
    return Object.freeze(this.executionStore.listExecutionRecordsForSystem(input).map((record) => Object.freeze({
      executionId: record.executionId,
      status: record.execution.status,
      startedAt: record.execution.startedAt,
      completedAt: record.execution.completedAt,
      rootVersionId: record.execution.root.versionId,
      result: record.execution.status === ExecutionStatusKinds.succeeded
        ? "succeeded"
        : record.execution.status === ExecutionStatusKinds.failed
          ? "failed"
          : record.execution.status === ExecutionStatusKinds.cancelled
            ? "cancelled"
            : "running",
      traceEventCount: record.metadata.trace.eventCount,
      traceLogCount: record.metadata.trace.logCount,
    })));
  }

  private async executeNestedSystemStep(input: {
    readonly node: { readonly nodeId: string; readonly assetId: string; readonly versionId?: string };
    readonly parentExecution: SystemExecution;
    readonly passIndex: number;
    readonly rootRequest: StartSystemRuntimeExecutionRequest;
  }): Promise<StepExecutionResult> {
    const startedAt = new Date().toISOString();
    if (!input.node.versionId) {
      return Object.freeze({
        nodeId: input.node.nodeId,
        status: "failed",
        startedAt,
        completedAt: new Date().toISOString(),
        error: {
          code: "nested-system-unpinned-version",
          message: `Nested system node '${input.node.nodeId}' requires a pinned child version.`,
        },
      });
    }

    const childRoot = await this.resolveSystemFromReference({
      assetId: input.node.assetId,
      versionId: input.node.versionId,
      alias: input.node.nodeId,
    });
    if (!childRoot) {
      return Object.freeze({
        nodeId: input.node.nodeId,
        status: "failed",
        startedAt,
        completedAt: new Date().toISOString(),
        error: {
          code: "nested-system-unresolved",
          message: `Nested system '${input.node.assetId}@${input.node.versionId}' could not be resolved.`,
        },
      });
    }

    const childBehavior = classifyExecutableBehavior(childRoot.taxonomy);
    const childRootContract = await this.resolveRootContract(childRoot);
    const childRuntimeContract = await mapSystemContractToRuntimeExecutionContract({
      root: childRoot,
      contract: childRootContract,
      resolveSystem: async (reference) => this.resolveSystemFromReference(reference),
      resolveChildContract: async (component) => this.resolveComponentContract(component),
      maxDepth: input.rootRequest.maxDepth,
    });
    const childInputValidation = this.runtimeInputValidation.validate({
      inputPayload: input.parentExecution.input.payload,
      runtimeContract: childRuntimeContract,
      contract: childRootContract,
    });
    if (!childInputValidation.valid) {
      return Object.freeze({
        nodeId: input.node.nodeId,
        status: "failed",
        startedAt,
        completedAt: new Date().toISOString(),
        error: {
          code: "nested-system-invalid-input",
          message: childInputValidation.errors[0]?.message ?? "Nested execution input validation failed.",
        },
        diagnostics: Object.freeze(childInputValidation.errors.map((entry) => `${entry.path}:${entry.code}`)),
      });
    }
    const childDependencyResolution = await resolveSystemRuntimeDependencies({
      root: childRoot,
      resolveSystem: async (reference) => this.resolveSystemFromReference(reference),
      maxDepth: input.rootRequest.maxDepth,
    });

    const childResult = await this.orchestration.orchestrate({
      root: childRoot,
      runtimeContract: childRuntimeContract,
      dependencyResolution: childDependencyResolution,
      behavior: childBehavior,
      executionId: `${input.parentExecution.executionId}:child:${input.node.nodeId}:${input.passIndex}`,
      context: {
        ...input.parentExecution.context,
        metadata: Object.freeze({
          ...(input.parentExecution.context.metadata ?? {}),
          parentExecutionId: input.parentExecution.executionId,
          parentNodeId: input.node.nodeId,
        }),
      },
      inputPayload: input.parentExecution.input.payload,
      inputContentType: input.parentExecution.input.contentType,
      inputSchemaVersion: input.parentExecution.input.schemaVersion,
      maxIterationsPerNode: input.rootRequest.maxIterationsPerNode,
      maxPlanningCyclesPerNode: input.rootRequest.maxPlanningCyclesPerNode,
      maxTraceEvents: input.rootRequest.maxTraceEvents,
      maxTraceLogs: input.rootRequest.maxTraceLogs,
      maxRuntimeErrors: input.rootRequest.maxRuntimeErrors,
      maxProgressionEntries: input.rootRequest.maxProgressionEntries,
      executeNestedSystemStep: async (nested) => this.executeNestedSystemStep({
        ...nested,
        rootRequest: input.rootRequest,
      }),
    });

    if (!childResult.execution) {
      return Object.freeze({
        nodeId: input.node.nodeId,
        status: "failed",
        startedAt,
        completedAt: new Date().toISOString(),
        error: {
          code: "nested-system-orchestration-failed",
          message: childResult.errors[0] ?? `Nested execution failed for node '${input.node.nodeId}'.`,
        },
      });
    }

    this.executionStore.saveExecutionRecord(this.createExecutionRecord(childResult.execution));

    return Object.freeze({
      nodeId: input.node.nodeId,
      status: childResult.execution.status === "succeeded" ? "succeeded" : "failed",
      startedAt,
      completedAt: childResult.execution.completedAt ?? childResult.execution.updatedAt,
      output: Object.freeze({
        nestedExecution: Object.freeze({
          executionId: childResult.execution.executionId,
          status: childResult.execution.status,
          rootAssetId: childResult.execution.root.assetId,
          rootVersionId: childResult.execution.root.versionId,
        }),
        output: childResult.execution.output,
      }),
      error: childResult.execution.status === "failed"
        ? Object.freeze({
          code: "nested-system-failure",
          message: `Nested execution '${childResult.execution.executionId}' failed.`,
        })
        : undefined,
    });
  }

  private createExecutionRecord(execution: SystemExecution): PersistedExecutionRecord {
    const nodeVersionIds = this.buildNodeVersionMap(execution);
    const outputPayload = execution.output?.payload as { readonly nodeResults?: Record<string, unknown> } | undefined;
    const childExecutionIds = Object.values(outputPayload?.nodeResults ?? {})
      .flatMap((entry) => {
        if (!entry || typeof entry !== "object") {
          return [];
        }
        const nested = (entry as { readonly nestedExecution?: { readonly executionId?: string } }).nestedExecution;
        return nested?.executionId ? [nested.executionId] : [];
      });
    const summary: ExecutionMetadataSnapshot = Object.freeze({
      executionId: execution.executionId,
      tenantId: typeof execution.context.metadata?.tenantId === "string"
        ? execution.context.metadata.tenantId
        : undefined,
      rootAssetId: execution.root.assetId,
      rootVersionId: execution.root.versionId,
      status: execution.status,
      startedAt: execution.startedAt,
      updatedAt: execution.updatedAt,
      completedAt: execution.completedAt,
      environmentId: execution.environment?.environmentId,
      trace: Object.freeze({
        eventCount: execution.runtimeState.trace.events.length,
        logCount: execution.runtimeState.trace.logs.length,
        lastEventAt: execution.runtimeState.trace.lastEventAt,
      }),
      result: Object.freeze({
        hasOutput: Boolean(execution.output),
        hasError: Boolean(execution.output?.error) || execution.status === ExecutionStatusKinds.failed,
        outputSummary: summarizeOutput(execution.output?.payload),
      }),
      executedVersionMap: Object.freeze({
        rootVersionId: execution.root.versionId,
        nodeVersionIds,
      }),
      parentExecutionId: typeof execution.context.metadata?.parentExecutionId === "string"
        ? execution.context.metadata.parentExecutionId
        : undefined,
      parentNodeId: typeof execution.context.metadata?.parentNodeId === "string"
        ? execution.context.metadata.parentNodeId
        : undefined,
      childExecutionIds: Object.freeze([...new Set(childExecutionIds)].sort((left, right) => left.localeCompare(right))),
      runtimeCapability: this.readRuntimeCapabilityTrace(execution),
    });

    return Object.freeze({
      executionId: execution.executionId,
      execution,
      metadata: summary,
    });
  }

  private buildNodeVersionMap(execution: SystemExecution): Readonly<Record<string, string>> {
    return Object.freeze(Object.fromEntries(execution.nodes
      .filter((node) => Boolean(node.target.versionId))
      .map((node) => [node.executionNodeId, node.target.versionId!])
      .sort(([left], [right]) => left.localeCompare(right))));
  }

  private readRuntimeCapabilityTrace(execution: SystemExecution): RuntimeCapabilityExecutionTrace | undefined {
    const trace = execution.context.metadata?.runtimeCapability;
    if (!trace || typeof trace !== "object") {
      return undefined;
    }
    const value = trace as Record<string, unknown>;
    const bindingId = typeof value.bindingId === "string" ? value.bindingId : undefined;
    const providerId = typeof value.providerId === "string" ? value.providerId : undefined;
    const profileId = typeof value.profileId === "string" ? value.profileId : undefined;
    const selectedModelBindingId = typeof value.selectedModelBindingId === "string"
      ? value.selectedModelBindingId
      : undefined;
    if (!bindingId || !providerId || !profileId || !selectedModelBindingId) {
      return undefined;
    }
    return Object.freeze({
      bindingId,
      providerId,
      profileId,
      selectedModelBindingId,
      resolvedAt: typeof value.resolvedAt === "string" ? value.resolvedAt : undefined,
      resolverVersion: typeof value.resolverVersion === "string" ? value.resolverVersion : undefined,
      stale: value.stale !== false,
    });
  }

  private buildNestedExecutionLineage(executionId: string): RuntimeExecutionResultReadModel["nestedExecutionLineage"] {
    const record = this.executionStore.getExecutionRecord(executionId);
    const childIds = record?.metadata.childExecutionIds ?? [];
    return Object.freeze(childIds
      .map((childExecutionId) => {
        const child = this.executionStore.getExecutionRecord(childExecutionId)?.metadata;
        if (!child) {
          return undefined;
        }
        return Object.freeze({
          executionId: child.executionId,
          parentExecutionId: child.parentExecutionId,
          parentNodeId: child.parentNodeId,
          rootAssetId: child.rootAssetId,
          rootVersionId: child.rootVersionId,
          status: child.status,
          startedAt: child.startedAt,
          completedAt: child.completedAt,
        });
      })
      .filter((entry): entry is NonNullable<typeof entry> => !!entry)
      .slice(0, 100));
  }

  private applyVersionPins(system: SystemAsset, pins?: Readonly<Record<string, string>>): SystemAsset {
    if (!pins || Object.keys(pins).length === 0) {
      return system;
    }

    const normalizedPins = new Map<string, string>();
    for (const [rawKey, rawVersionId] of Object.entries(pins)) {
      const key = rawKey.trim();
      const versionId = rawVersionId.trim();
      if (key && versionId) {
        normalizedPins.set(key, versionId);
      }
    }

    if (normalizedPins.size === 0) {
      return system;
    }

    const withPinnedComponents = system.components.map((component) => {
      const pin = normalizedPins.get(component.alias ?? "")
        ?? normalizedPins.get(component.assetId)
        ?? component.versionId;
      return Object.freeze({
        ...component,
        versionId: pin,
      });
    });

    const withPinnedNestedSystems = system.nestedSystems.map((entry) => {
      const pin = normalizedPins.get(entry.alias ?? "")
        ?? normalizedPins.get(entry.assetId)
        ?? entry.versionId;
      return Object.freeze({
        ...entry,
        versionId: pin,
      });
    });

    const withPinnedDependencies = system.dependencies.map((dependency) => {
      const pin = normalizedPins.get(dependency.assetId) ?? dependency.versionId;
      return Object.freeze({
        ...dependency,
        versionId: pin,
      });
    });

    return createSystemAsset({
      ...system,
      components: withPinnedComponents,
      nestedSystems: withPinnedNestedSystems,
      dependencies: withPinnedDependencies,
    });
  }

  private assertVersionPinnedExecution(input: {
    readonly root: SystemAsset;
    readonly enforceVersionPinning: boolean;
  }): void {
    if (!input.enforceVersionPinning) {
      return;
    }

    const unresolvedChildren = input.root.components
      .filter((component) => requiresPinnedRuntimeComponentVersion({
        component,
        hasResolvedContract: Boolean(component.taxonomy && this.contractResolver.resolveContractForTaxonomy(component.taxonomy)),
      }))
      .map((component) => component.alias ?? component.assetId);
    if (unresolvedChildren.length > 0) {
      throw new Error(`invalid-request:Execution requires pinned component versions. Missing version for: ${unresolvedChildren.join(", ")}.`);
    }

    const unresolvedDependencies = input.root.dependencies
      .filter((dependency) => !dependency.versionId)
      .map((dependency) => dependency.assetId);
    if (unresolvedDependencies.length > 0) {
      throw new Error(`invalid-request:Execution requires pinned dependency versions. Missing version for: ${unresolvedDependencies.join(", ")}.`);
    }
  }
}
