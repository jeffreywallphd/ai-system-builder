import {
  createAssetContractDescriptor,
  type AssetContractDescriptor,
} from "../../domain/contracts/AssetContract";
import {
  aggregateSystemDependencies,
  buildNestedSystemReferences,
  collectSystemDirectDependencies,
  createSystemAsset,
  createSystemAssetMetadata,
  createSystemStudioTaxonomy,
  SystemStudioIdentity,
  type SystemAsset,
  type SystemCompositionReference,
  type SystemComponentReference,
} from "../../domain/system-studio/SystemAssetDomain";
import { AssetDraftLifecycleStatuses, type AssetDraftDependencyReference } from "../../domain/studio-shell/StudioShellDomain";
import type {
  AssetDraftResult,
  AssetVersionResult,
  StudioInitializationResult,
  StudioSessionResult,
  UpdateAssetDraftCommand,
} from "../studio-shell/contracts";
import type { StudioShellApplicationService } from "../studio-shell/StudioShellApplicationService";
import type { IStudioShellRepository } from "../ports/interfaces/IStudioShellRepository";
import {
  StudioShellConflictError,
  StudioShellInvalidRequestError,
} from "../studio-shell/StudioShellApplicationErrors";
import type { IAssetContractResolver } from "../contracts/CompositionAssetContractResolver";
import { CompositionAssetContractResolver } from "../contracts/CompositionAssetContractResolver";
import {
  assertSystemStudioDraftPublishConsistency,
  evaluateSystemStudioDraftConsistency,
  type StudioAssetEnforcementIssue,
} from "../studio-shell/AtomicStudioAssetEnforcement";
import type { AssetVersion } from "../../domain/assets/AssetVersion";

export interface EnsureSystemStudioResult {
  readonly initialized: boolean;
  readonly studio: StudioInitializationResult["studio"];
  readonly session: StudioInitializationResult["activeSession"];
}

export interface CreateSystemDraftCommand {
  readonly studioId?: string;
  readonly sessionId: string;
  readonly draftId?: string;
  readonly title: string;
  readonly summary?: string;
  readonly content: string;
  readonly tags?: ReadonlyArray<string>;
  readonly creatorId?: string;
  readonly semanticRole?: "system" | "app-template";
  readonly behaviorKind?: "deterministic" | "conditional" | "iterative" | "autonomous";
  readonly dependencies?: ReadonlyArray<AssetDraftDependencyReference>;
}

export interface UpdateSystemDraftCommand {
  readonly studioId?: string;
  readonly sessionId: string;
  readonly draftId: string;
  readonly content?: string;
  readonly summary?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly semanticRole?: "system" | "app-template";
  readonly behaviorKind?: "deterministic" | "conditional" | "iterative" | "autonomous";
  readonly dependencies?: ReadonlyArray<AssetDraftDependencyReference>;
}

export interface ValidateSystemDraftCommand {
  readonly studioId?: string;
  readonly draftId: string;
  readonly maxDepth?: number;
}

export interface ValidateSystemDraftResult {
  readonly draft: AssetDraftResult["draft"];
  readonly issues: ReadonlyArray<StudioAssetEnforcementIssue>;
}

export interface PublishSystemDraftCommand {
  readonly studioId?: string;
  readonly sessionId: string;
  readonly draftId: string;
  readonly versionId?: string;
  readonly versionLabel?: string;
  readonly createdBy?: string;
  readonly maxDepth?: number;
}

export interface AddSystemChildComponentCommand {
  readonly studioId?: string;
  readonly sessionId: string;
  readonly draftId: string;
  readonly component: SystemComponentReference;
}

export interface RemoveSystemChildComponentCommand {
  readonly studioId?: string;
  readonly sessionId: string;
  readonly draftId: string;
  readonly componentAssetId: string;
  readonly componentVersionId?: string;
}

export interface ReorderSystemChildComponentCommand {
  readonly studioId?: string;
  readonly sessionId: string;
  readonly draftId: string;
  readonly componentAssetId: string;
  readonly componentVersionId?: string;
  readonly toIndex: number;
}

interface SystemSpecContent {
  readonly components?: ReadonlyArray<SystemAsset["components"][number]>;
  readonly nestedSystems?: ReadonlyArray<SystemAsset["nestedSystems"][number]>;
  readonly inputs?: ReadonlyArray<SystemAsset["inputs"][number]>;
  readonly outputs?: ReadonlyArray<SystemAsset["outputs"][number]>;
  readonly parameters?: ReadonlyArray<SystemAsset["parameters"][number]>;
  readonly bindings?: ReadonlyArray<SystemAsset["bindings"][number]>;
}

export interface UpdateSystemInterfacesCommand {
  readonly studioId?: string;
  readonly sessionId: string;
  readonly draftId: string;
  readonly inputs: ReadonlyArray<SystemAsset["inputs"][number]>;
  readonly outputs: ReadonlyArray<SystemAsset["outputs"][number]>;
}

export interface UpdateSystemParametersCommand {
  readonly studioId?: string;
  readonly sessionId: string;
  readonly draftId: string;
  readonly parameters: ReadonlyArray<SystemAsset["parameters"][number]>;
}

function parseSystemContent(content: string): SystemSpecContent {
  if (!content.trim()) {
    return Object.freeze({});
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new StudioShellInvalidRequestError("System draft content must be valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new StudioShellInvalidRequestError("System draft content must be a JSON object.");
  }

  const root = parsed as { readonly systemSpec?: unknown };
  const spec = (root.systemSpec && typeof root.systemSpec === "object")
    ? root.systemSpec as {
      readonly components?: ReadonlyArray<SystemAsset["components"][number]>;
      readonly nestedSystems?: ReadonlyArray<SystemAsset["nestedSystems"][number]>;
      readonly inputs?: ReadonlyArray<SystemAsset["inputs"][number]>;
      readonly outputs?: ReadonlyArray<SystemAsset["outputs"][number]>;
      readonly parameters?: ReadonlyArray<SystemAsset["parameters"][number]>;
      readonly bindings?: ReadonlyArray<SystemAsset["bindings"][number]>;
    }
    : undefined;

  return Object.freeze({
    components: spec?.components,
    nestedSystems: spec?.nestedSystems,
    inputs: spec?.inputs,
    outputs: spec?.outputs,
    parameters: spec?.parameters,
    bindings: spec?.bindings,
  });
}

function parseSystemContentEnvelope(content: string): Record<string, unknown> {
  if (!content.trim()) {
    return {};
  }
  const parsed = JSON.parse(content) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  return { ...(parsed as Record<string, unknown>) };
}

function serializeSystemContent(input: {
  readonly content: string;
  readonly spec: SystemSpecContent;
}): string {
  const root = parseSystemContentEnvelope(input.content);
  const existingSpec = (root.systemSpec && typeof root.systemSpec === "object" && !Array.isArray(root.systemSpec))
    ? root.systemSpec as Record<string, unknown>
    : {};
  root.systemSpec = {
    ...existingSpec,
    ...input.spec,
  };
  return JSON.stringify(root, null, 2);
}

function splitStandaloneDependencies(input: {
  readonly dependencies: ReadonlyArray<AssetDraftDependencyReference>;
  readonly components: ReadonlyArray<SystemComponentReference>;
  readonly nestedSystems: ReadonlyArray<SystemCompositionReference>;
}): ReadonlyArray<AssetDraftDependencyReference> {
  const componentKeys = new Set(input.components.map((entry) => `${entry.assetId}::${entry.versionId ?? ""}`));
  const nestedKeys = new Set(input.nestedSystems.map((entry) => `${entry.assetId}::${entry.versionId ?? ""}`));
  return input.dependencies.filter((dependency) => {
    const key = `${dependency.assetId}::${dependency.versionId ?? ""}`;
    return !componentKeys.has(key) && !nestedKeys.has(key);
  });
}

function tryReadPublishedDraftEnvelope(version: AssetVersion): {
  readonly metadata?: AssetDraftResult["draft"]["metadata"];
  readonly dependencies?: ReadonlyArray<AssetDraftDependencyReference>;
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

  const metadata = payload.metadata as AssetDraftResult["draft"]["metadata"] | undefined;
  const dependencies = Array.isArray(payload.dependencies)
    ? payload.dependencies as ReadonlyArray<AssetDraftDependencyReference>
    : undefined;
  const content = typeof payload.content === "string" ? payload.content : undefined;

  return Object.freeze({ metadata, dependencies, content });
}

export class SystemStudioApplicationService {
  constructor(
    private readonly studioShellService: StudioShellApplicationService,
    private readonly repository: IStudioShellRepository,
    private readonly contractResolver: Pick<IAssetContractResolver, "resolveContractForTaxonomy" | "resolveSystemContract"> = new CompositionAssetContractResolver(),
  ) {}

  public async ensureStudioInitialized(
    studioId: string = SystemStudioIdentity.defaultStudioId,
    studioName: string = SystemStudioIdentity.defaultStudioName,
  ): Promise<EnsureSystemStudioResult> {
    const normalizedStudioId = studioId.trim();
    let initialized = false;
    let sessionResult: StudioSessionResult;
    try {
      const created = await this.studioShellService.initializeStudio({
        studioId: normalizedStudioId,
        name: studioName,
      });
      initialized = true;
      sessionResult = Object.freeze({
        studio: created.studio,
        session: created.activeSession,
        drafts: Object.freeze([]),
      });
    } catch (error) {
      if (!(error instanceof StudioShellConflictError)) {
        throw error;
      }
      sessionResult = await this.studioShellService.startAssetSession({
        studioId: normalizedStudioId,
      });
    }

    return Object.freeze({
      initialized,
      studio: sessionResult.studio,
      session: sessionResult.session,
    });
  }

  public async createSystemDraft(command: CreateSystemDraftCommand): Promise<AssetDraftResult> {
    const studioId = command.studioId?.trim() || SystemStudioIdentity.defaultStudioId;
    const taxonomy = createSystemStudioTaxonomy(command.semanticRole, command.behaviorKind);
    const provisional = createSystemAsset({
      assetId: `studio-asset:${command.draftId?.trim() || "system-draft"}`,
      taxonomy,
      dependencies: command.dependencies,
      ...parseSystemContent(command.content),
    });
    const contract = await this.contractResolver.resolveSystemContract({
      root: provisional,
      resolveSystem: async () => undefined,
      resolveChildContract: async (component) => this.resolveComponentContract(component),
    });

    return this.studioShellService.createAssetDraft({
      studioId,
      sessionId: command.sessionId,
      draftId: command.draftId,
      content: command.content,
      metadata: createSystemAssetMetadata({
        title: command.title,
        summary: command.summary,
        tags: command.tags,
        creatorId: command.creatorId,
        semanticRole: command.semanticRole,
        behaviorKind: command.behaviorKind,
        contract,
      }),
      dependencies: command.dependencies,
    });
  }

  public async updateSystemDraft(command: UpdateSystemDraftCommand): Promise<AssetDraftResult> {
    const studioId = command.studioId?.trim() || SystemStudioIdentity.defaultStudioId;
    const loaded = await this.studioShellService.loadAssetDraft({ studioId, draftId: command.draftId });
    if (!loaded) {
      throw new StudioShellInvalidRequestError(`Draft '${command.draftId}' is not available in studio '${studioId}'.`);
    }

    const taxonomy = createSystemStudioTaxonomy(
      command.semanticRole ?? loaded.draft.metadata.taxonomy?.semanticRole as "system" | "app-template" | undefined,
      command.behaviorKind ?? loaded.draft.metadata.taxonomy?.behaviorKind as "deterministic" | "conditional" | "iterative" | "autonomous" | undefined,
    );
    const content = command.content ?? loaded.draft.content;
    const dependencies = command.dependencies ?? loaded.draft.dependencies;
    const systemAsset = createSystemAsset({
      assetId: loaded.draft.assetId,
      taxonomy,
      dependencies,
      ...parseSystemContent(content),
    });

    const contract = await this.contractResolver.resolveSystemContract({
      root: systemAsset,
      resolveSystem: (reference) => this.resolveSystemFromReference(reference),
      resolveChildContract: (component) => this.resolveComponentContract(component),
    });

    const updateCommand: UpdateAssetDraftCommand = {
      studioId,
      sessionId: command.sessionId,
      draftId: command.draftId,
      content: command.content,
      metadataPatch: {
        summary: command.summary,
        tags: command.tags,
        taxonomy,
        contract,
      },
    };

    const updated = await this.studioShellService.updateAssetDraft(updateCommand);
    if (command.dependencies) {
      return this.studioShellService.updateAssetDraftDependencies({
        studioId,
        sessionId: command.sessionId,
        draftId: command.draftId,
        dependencies: command.dependencies,
      });
    }

    return updated;
  }

  public async validateSystemDraft(command: ValidateSystemDraftCommand): Promise<ValidateSystemDraftResult> {
    const studioId = command.studioId?.trim() || SystemStudioIdentity.defaultStudioId;
    const loaded = await this.studioShellService.loadAssetDraft({ studioId, draftId: command.draftId });
    if (!loaded) {
      throw new StudioShellInvalidRequestError(`Draft '${command.draftId}' is not available in studio '${studioId}'.`);
    }

    const systemAsset = createSystemAsset({
      assetId: loaded.draft.assetId,
      taxonomy: loaded.draft.metadata.taxonomy ?? createSystemStudioTaxonomy(),
      provenance: loaded.draft.metadata.provenance,
      dependencies: loaded.draft.dependencies,
      ...parseSystemContent(loaded.draft.content),
    });

    const issues = await evaluateSystemStudioDraftConsistency({
      draft: loaded.draft,
      expectation: {
        studioType: SystemStudioIdentity.studioType,
        semanticRole: (loaded.draft.metadata.taxonomy?.semanticRole as "system" | "app-template" | undefined) ?? "system",
        allowedBehaviorKinds: ["deterministic", "conditional", "iterative", "autonomous"],
      },
      contractResolver: this.contractResolver,
      systemAsset,
      resolveSystem: (reference) => this.resolveSystemFromReference(reference),
      resolveChildContract: (component) => this.resolveComponentContract(component),
      maxDepth: command.maxDepth,
    });

    return Object.freeze({ draft: loaded.draft, issues });
  }

  public async publishSystemDraft(command: PublishSystemDraftCommand): Promise<AssetVersionResult> {
    const studioId = command.studioId?.trim() || SystemStudioIdentity.defaultStudioId;
    const loaded = await this.studioShellService.loadAssetDraft({ studioId, draftId: command.draftId });
    if (!loaded) {
      throw new StudioShellInvalidRequestError(`Draft '${command.draftId}' is not available in studio '${studioId}'.`);
    }

    const systemAsset = createSystemAsset({
      assetId: loaded.draft.assetId,
      taxonomy: loaded.draft.metadata.taxonomy ?? createSystemStudioTaxonomy(),
      provenance: loaded.draft.metadata.provenance,
      dependencies: loaded.draft.dependencies,
      ...parseSystemContent(loaded.draft.content),
    });

    const projectedContract = await this.contractResolver.resolveSystemContract({
      root: systemAsset,
      resolveSystem: (reference) => this.resolveSystemFromReference(reference),
      resolveChildContract: (component) => this.resolveComponentContract(component),
      maxDepth: command.maxDepth,
    });

    const currentContract = loaded.draft.metadata.contract;
    if (!currentContract || JSON.stringify(currentContract) !== JSON.stringify(projectedContract)) {
      await this.studioShellService.updateAssetDraft({
        studioId,
        sessionId: command.sessionId,
        draftId: command.draftId,
        metadataPatch: { contract: projectedContract },
      });
    }

    const refreshed = await this.studioShellService.loadAssetDraft({ studioId, draftId: command.draftId });
    if (!refreshed) {
      throw new StudioShellInvalidRequestError(`Draft '${command.draftId}' is not available in studio '${studioId}'.`);
    }

    await assertSystemStudioDraftPublishConsistency({
      draft: refreshed.draft,
      expectation: {
        studioType: SystemStudioIdentity.studioType,
        semanticRole: (refreshed.draft.metadata.taxonomy?.semanticRole as "system" | "app-template" | undefined) ?? "system",
        allowedBehaviorKinds: ["deterministic", "conditional", "iterative", "autonomous"],
      },
      contractResolver: this.contractResolver,
      systemAsset,
      resolveSystem: (reference) => this.resolveSystemFromReference(reference),
      resolveChildContract: (component) => this.resolveComponentContract(component),
      maxDepth: command.maxDepth,
    });

    await this.studioShellService.transitionAssetDraftLifecycle({
      studioId,
      sessionId: command.sessionId,
      draftId: command.draftId,
      targetStatus: AssetDraftLifecycleStatuses.validated,
    });

    return this.studioShellService.publishAssetDraftVersion({
      studioId,
      sessionId: command.sessionId,
      draftId: command.draftId,
      versionId: command.versionId,
      versionLabel: command.versionLabel,
      createdBy: command.createdBy,
      upstreamVersionIds: await this.resolveAggregatedUpstreamVersionIds(systemAsset, command.maxDepth),
    });
  }

  public async addSystemChildComponent(command: AddSystemChildComponentCommand): Promise<AssetDraftResult> {
    const studioId = command.studioId?.trim() || SystemStudioIdentity.defaultStudioId;
    const loaded = await this.studioShellService.loadAssetDraft({ studioId, draftId: command.draftId });
    if (!loaded) {
      throw new StudioShellInvalidRequestError(`Draft '${command.draftId}' is not available in studio '${studioId}'.`);
    }

    const spec = parseSystemContent(loaded.draft.content);
    const standaloneDependencies = splitStandaloneDependencies({
      dependencies: loaded.draft.dependencies,
      components: spec.components ?? [],
      nestedSystems: spec.nestedSystems ?? [],
    });
    const nextComponents = [...(spec.components ?? []), command.component];
    const nextSystem = createSystemAsset({
      assetId: loaded.draft.assetId,
      taxonomy: loaded.draft.metadata.taxonomy ?? createSystemStudioTaxonomy(),
      dependencies: standaloneDependencies,
      components: nextComponents,
      nestedSystems: spec.nestedSystems,
      inputs: spec.inputs,
      outputs: spec.outputs,
      parameters: spec.parameters,
      bindings: spec.bindings,
    });
    const dependencies = collectSystemDirectDependencies(nextSystem);
    return this.updateSystemDraft({
      studioId,
      sessionId: command.sessionId,
      draftId: command.draftId,
      content: serializeSystemContent({
        content: loaded.draft.content,
        spec: {
          components: nextSystem.components,
          nestedSystems: buildNestedSystemReferences(nextSystem),
        },
      }),
      dependencies,
    });
  }

  public async removeSystemChildComponent(command: RemoveSystemChildComponentCommand): Promise<AssetDraftResult> {
    const studioId = command.studioId?.trim() || SystemStudioIdentity.defaultStudioId;
    const loaded = await this.studioShellService.loadAssetDraft({ studioId, draftId: command.draftId });
    if (!loaded) {
      throw new StudioShellInvalidRequestError(`Draft '${command.draftId}' is not available in studio '${studioId}'.`);
    }

    const spec = parseSystemContent(loaded.draft.content);
    const standaloneDependencies = splitStandaloneDependencies({
      dependencies: loaded.draft.dependencies,
      components: spec.components ?? [],
      nestedSystems: spec.nestedSystems ?? [],
    });
    const filteredComponents = (spec.components ?? []).filter((entry) => (
      !(entry.assetId === command.componentAssetId && (entry.versionId ?? "") === (command.componentVersionId?.trim() ?? ""))
    ));
    const nextSystem = createSystemAsset({
      assetId: loaded.draft.assetId,
      taxonomy: loaded.draft.metadata.taxonomy ?? createSystemStudioTaxonomy(),
      dependencies: standaloneDependencies,
      components: filteredComponents,
      nestedSystems: spec.nestedSystems,
      inputs: spec.inputs,
      outputs: spec.outputs,
      parameters: spec.parameters,
      bindings: spec.bindings,
    });
    const dependencies = collectSystemDirectDependencies(nextSystem);
    return this.updateSystemDraft({
      studioId,
      sessionId: command.sessionId,
      draftId: command.draftId,
      content: serializeSystemContent({
        content: loaded.draft.content,
        spec: {
          components: nextSystem.components,
          nestedSystems: buildNestedSystemReferences(nextSystem),
        },
      }),
      dependencies,
    });
  }

  public async reorderSystemChildComponent(command: ReorderSystemChildComponentCommand): Promise<AssetDraftResult> {
    const studioId = command.studioId?.trim() || SystemStudioIdentity.defaultStudioId;
    const loaded = await this.studioShellService.loadAssetDraft({ studioId, draftId: command.draftId });
    if (!loaded) {
      throw new StudioShellInvalidRequestError(`Draft '${command.draftId}' is not available in studio '${studioId}'.`);
    }

    const spec = parseSystemContent(loaded.draft.content);
    const components = [...(spec.components ?? [])];
    const currentIndex = components.findIndex((entry) => (
      entry.assetId === command.componentAssetId && (entry.versionId ?? "") === (command.componentVersionId?.trim() ?? "")
    ));
    if (currentIndex < 0) {
      throw new StudioShellInvalidRequestError("Requested component is not present in the current system draft.");
    }
    const boundedTarget = Math.max(0, Math.min(command.toIndex, components.length - 1));
    const [moved] = components.splice(currentIndex, 1);
    components.splice(boundedTarget, 0, moved);

    return this.updateSystemDraft({
      studioId,
      sessionId: command.sessionId,
      draftId: command.draftId,
      content: serializeSystemContent({
        content: loaded.draft.content,
        spec: {
          components,
          nestedSystems: buildNestedSystemReferences(createSystemAsset({
            assetId: loaded.draft.assetId,
            taxonomy: loaded.draft.metadata.taxonomy ?? createSystemStudioTaxonomy(),
            dependencies: loaded.draft.dependencies,
            components,
            nestedSystems: spec.nestedSystems,
            inputs: spec.inputs,
            outputs: spec.outputs,
            parameters: spec.parameters,
            bindings: spec.bindings,
          })),
        },
      }),
    });
  }

  public async updateSystemInterfaces(command: UpdateSystemInterfacesCommand): Promise<AssetDraftResult> {
    const studioId = command.studioId?.trim() || SystemStudioIdentity.defaultStudioId;
    const loaded = await this.studioShellService.loadAssetDraft({ studioId, draftId: command.draftId });
    if (!loaded) {
      throw new StudioShellInvalidRequestError(`Draft '${command.draftId}' is not available in studio '${studioId}'.`);
    }

    const spec = parseSystemContent(loaded.draft.content);
    const nextSystem = createSystemAsset({
      assetId: loaded.draft.assetId,
      taxonomy: loaded.draft.metadata.taxonomy ?? createSystemStudioTaxonomy(),
      dependencies: loaded.draft.dependencies,
      components: spec.components,
      nestedSystems: spec.nestedSystems,
      inputs: command.inputs,
      outputs: command.outputs,
      parameters: spec.parameters,
      bindings: spec.bindings,
    });

    return this.updateSystemDraft({
      studioId,
      sessionId: command.sessionId,
      draftId: command.draftId,
      content: serializeSystemContent({
        content: loaded.draft.content,
        spec: {
          components: nextSystem.components,
          nestedSystems: buildNestedSystemReferences(nextSystem),
          inputs: nextSystem.inputs,
          outputs: nextSystem.outputs,
          parameters: nextSystem.parameters,
          bindings: nextSystem.bindings,
        },
      }),
      dependencies: collectSystemDirectDependencies(nextSystem),
    });
  }

  public async updateSystemParameters(command: UpdateSystemParametersCommand): Promise<AssetDraftResult> {
    const studioId = command.studioId?.trim() || SystemStudioIdentity.defaultStudioId;
    const loaded = await this.studioShellService.loadAssetDraft({ studioId, draftId: command.draftId });
    if (!loaded) {
      throw new StudioShellInvalidRequestError(`Draft '${command.draftId}' is not available in studio '${studioId}'.`);
    }

    const spec = parseSystemContent(loaded.draft.content);
    const nextSystem = createSystemAsset({
      assetId: loaded.draft.assetId,
      taxonomy: loaded.draft.metadata.taxonomy ?? createSystemStudioTaxonomy(),
      dependencies: loaded.draft.dependencies,
      components: spec.components,
      nestedSystems: spec.nestedSystems,
      inputs: spec.inputs,
      outputs: spec.outputs,
      parameters: command.parameters,
      bindings: spec.bindings,
    });

    return this.updateSystemDraft({
      studioId,
      sessionId: command.sessionId,
      draftId: command.draftId,
      content: serializeSystemContent({
        content: loaded.draft.content,
        spec: {
          components: nextSystem.components,
          nestedSystems: buildNestedSystemReferences(nextSystem),
          inputs: nextSystem.inputs,
          outputs: nextSystem.outputs,
          parameters: nextSystem.parameters,
          bindings: nextSystem.bindings,
        },
      }),
      dependencies: collectSystemDirectDependencies(nextSystem),
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

    const envelope = tryReadPublishedDraftEnvelope(version);
    if (!envelope.metadata?.taxonomy || envelope.metadata.taxonomy.structuralKind !== "system") {
      return undefined;
    }

    return createSystemAsset({
      assetId: version.assetId.value,
      versionId: version.versionId,
      taxonomy: envelope.metadata.taxonomy,
      provenance: envelope.metadata.provenance,
      dependencies: envelope.dependencies,
      ...parseSystemContent(envelope.content ?? ""),
    });
  }

  private async resolveComponentContract(component: SystemComponentReference): Promise<AssetContractDescriptor | undefined> {
    if (component.versionId) {
      const version = await this.repository.getAssetVersion(component.versionId);
      if (version && version.assetId.value === component.assetId) {
        const envelope = tryReadPublishedDraftEnvelope(version);
        if (envelope.metadata?.contract) {
          return createAssetContractDescriptor(envelope.metadata.contract);
        }
        if (envelope.metadata?.taxonomy) {
          return this.contractResolver.resolveContractForTaxonomy(envelope.metadata.taxonomy);
        }
      }
    }

    return component.taxonomy
      ? this.contractResolver.resolveContractForTaxonomy(component.taxonomy)
      : undefined;
  }

  private async resolveAggregatedUpstreamVersionIds(
    system: SystemAsset,
    maxDepth?: number,
  ): Promise<ReadonlyArray<string>> {
    const summary = await aggregateSystemDependencies({
      root: system,
      resolveSystem: (reference) => this.resolveSystemFromReference(reference),
      maxDepth,
    }).catch(() => undefined);
    if (!summary) {
      return Object.freeze([]);
    }

    const pinned = [...new Set(summary.allDependencies
      .map((dependency) => dependency.versionId?.trim())
      .filter((versionId): versionId is string => Boolean(versionId)))];
    return Object.freeze(pinned);
  }
}
