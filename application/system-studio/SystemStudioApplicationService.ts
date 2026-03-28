import {
  createAssetContractDescriptor,
  type AssetContractDescriptor,
} from "../../domain/contracts/AssetContract";
import {
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

function parseSystemContent(content: string): {
  readonly components?: ReadonlyArray<SystemAsset["components"][number]>;
  readonly nestedSystems?: ReadonlyArray<SystemAsset["nestedSystems"][number]>;
  readonly inputs?: ReadonlyArray<SystemAsset["inputs"][number]>;
  readonly outputs?: ReadonlyArray<SystemAsset["outputs"][number]>;
  readonly parameters?: ReadonlyArray<SystemAsset["parameters"][number]>;
  readonly bindings?: ReadonlyArray<SystemAsset["bindings"][number]>;
} {
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
}
