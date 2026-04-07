import type { IAssetContractResolver } from "../contracts/CompositionAssetContractResolver";
import { CompositionAssetContractResolver } from "../contracts/CompositionAssetContractResolver";
import { AssetDraftLifecycleStatuses } from "@domain/studio-shell/StudioShellDomain";
import { createModelAssetMetadata, createModelStudioTaxonomy, ModelStudioIdentity } from "@domain/model-studio/ModelStudioDomain";
import type { StudioShellApplicationService } from "../studio-shell/StudioShellApplicationService";
import type { AssetDraftDependencyReference } from "@domain/studio-shell/StudioShellDomain";
import type { AssetDraftResult, AssetVersionResult, StudioInitializationResult, StudioSessionResult } from "../studio-shell/contracts";
import { StudioShellConflictError, StudioShellInvalidRequestError } from "../studio-shell/StudioShellApplicationErrors";
import { assertAtomicStudioDraftPublishConsistency } from "../studio-shell/AtomicStudioAssetEnforcement";

export interface EnsureModelStudioResult {
  readonly initialized: boolean;
  readonly studio: StudioInitializationResult["studio"];
  readonly session: StudioInitializationResult["activeSession"];
}

export interface CreateModelDraftCommand {
  readonly studioId?: string;
  readonly sessionId: string;
  readonly title: string;
  readonly summary?: string;
  readonly content: string;
  readonly tags?: ReadonlyArray<string>;
  readonly creatorId?: string;
  readonly dependencies?: ReadonlyArray<AssetDraftDependencyReference>;
}

export interface PublishModelDraftCommand {
  readonly studioId?: string;
  readonly sessionId: string;
  readonly draftId: string;
  readonly versionId?: string;
  readonly versionLabel?: string;
  readonly createdBy?: string;
}

export class ModelStudioApplicationService {
  constructor(
    private readonly studioShellService: StudioShellApplicationService,
    private readonly contractResolver: Pick<IAssetContractResolver, "resolveContractForTaxonomy"> = new CompositionAssetContractResolver(),
  ) {}

  public async ensureStudioInitialized(
    studioId: string = ModelStudioIdentity.defaultStudioId,
    studioName: string = ModelStudioIdentity.defaultStudioName,
  ): Promise<EnsureModelStudioResult> {
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

  public async createModelDraft(command: CreateModelDraftCommand): Promise<AssetDraftResult> {
    const studioId = command.studioId?.trim() || ModelStudioIdentity.defaultStudioId;
    const taxonomy = createModelStudioTaxonomy();
    const contract = this.contractResolver.resolveContractForTaxonomy(taxonomy);

    return this.studioShellService.createAssetDraft({
      studioId,
      sessionId: command.sessionId,
      content: command.content,
      metadata: createModelAssetMetadata({
        title: command.title,
        summary: command.summary,
        tags: command.tags,
        creatorId: command.creatorId,
        contract,
      }),
      dependencies: command.dependencies,
    });
  }

  private async assertPublishConsistency(studioId: string, draftId: string): Promise<void> {
    const snapshot = await this.studioShellService.loadAssetDraft({ studioId, draftId });
    if (!snapshot) {
      throw new StudioShellInvalidRequestError(`Draft '${draftId}' is not available in studio '${studioId}'.`);
    }

    assertAtomicStudioDraftPublishConsistency({
      draft: snapshot.draft,
      expectation: {
        studioType: ModelStudioIdentity.studioType,
        semanticRole: "model",
        allowedBehaviorKinds: ["none"],
      },
      contractResolver: this.contractResolver,
    });
  }

  public async publishModelDraft(command: PublishModelDraftCommand): Promise<AssetVersionResult> {
    const studioId = command.studioId?.trim() || ModelStudioIdentity.defaultStudioId;
    await this.assertPublishConsistency(studioId, command.draftId);
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
}

