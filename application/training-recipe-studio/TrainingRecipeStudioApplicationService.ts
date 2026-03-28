import type { IAssetContractResolver } from "../contracts/CompositionAssetContractResolver";
import { CompositionAssetContractResolver } from "../contracts/CompositionAssetContractResolver";
import type { AssetDraftDependencyReference } from "../../domain/studio-shell/StudioShellDomain";
import { AssetDraftLifecycleStatuses } from "../../domain/studio-shell/StudioShellDomain";
import type {
  AssetDraftResult,
  AssetVersionResult,
  StudioInitializationResult,
  StudioSessionResult,
} from "../studio-shell/contracts";
import type { StudioShellApplicationService } from "../studio-shell/StudioShellApplicationService";
import { StudioShellConflictError, StudioShellInvalidRequestError } from "../studio-shell/StudioShellApplicationErrors";
import { assertCompositeStudioDraftPublishConsistency } from "../studio-shell/AtomicStudioAssetEnforcement";
import {
  createTrainingRecipeAssetMetadata,
  createTrainingRecipeStudioTaxonomy,
  TrainingRecipeStudioIdentity,
} from "../../domain/training-recipe-studio/TrainingRecipeStudioDomain";

export interface EnsureTrainingRecipeStudioResult {
  readonly initialized: boolean;
  readonly studio: StudioInitializationResult["studio"];
  readonly session: StudioInitializationResult["activeSession"];
}

export interface CreateTrainingRecipeDraftCommand {
  readonly studioId?: string;
  readonly sessionId: string;
  readonly title: string;
  readonly summary?: string;
  readonly content: string;
  readonly tags?: ReadonlyArray<string>;
  readonly creatorId?: string;
  readonly dependencies?: ReadonlyArray<AssetDraftDependencyReference>;
}

export interface PublishTrainingRecipeDraftCommand {
  readonly studioId?: string;
  readonly sessionId: string;
  readonly draftId: string;
  readonly versionId?: string;
  readonly versionLabel?: string;
  readonly createdBy?: string;
}

export class TrainingRecipeStudioApplicationService {
  constructor(
    private readonly studioShellService: StudioShellApplicationService,
    private readonly contractResolver: Pick<IAssetContractResolver, "resolveContractForTaxonomy"> = new CompositionAssetContractResolver(),
  ) {}

  public async ensureStudioInitialized(
    studioId: string = TrainingRecipeStudioIdentity.defaultStudioId,
    studioName: string = TrainingRecipeStudioIdentity.defaultStudioName,
  ): Promise<EnsureTrainingRecipeStudioResult> {
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

  public async createTrainingRecipeDraft(command: CreateTrainingRecipeDraftCommand): Promise<AssetDraftResult> {
    const studioId = command.studioId?.trim() || TrainingRecipeStudioIdentity.defaultStudioId;
    const taxonomy = createTrainingRecipeStudioTaxonomy();
    const contract = this.contractResolver.resolveContractForTaxonomy(taxonomy);

    return this.studioShellService.createAssetDraft({
      studioId,
      sessionId: command.sessionId,
      content: command.content,
      metadata: createTrainingRecipeAssetMetadata({
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

    assertCompositeStudioDraftPublishConsistency({
      draft: snapshot.draft,
      expectation: {
        studioType: TrainingRecipeStudioIdentity.studioType,
        semanticRole: "training-recipe",
        allowedBehaviorKinds: ["deterministic"],
      },
      contractResolver: this.contractResolver,
    });
  }

  public async publishTrainingRecipeDraft(command: PublishTrainingRecipeDraftCommand): Promise<AssetVersionResult> {
    const studioId = command.studioId?.trim() || TrainingRecipeStudioIdentity.defaultStudioId;
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
