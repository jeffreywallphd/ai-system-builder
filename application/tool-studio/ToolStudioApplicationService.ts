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
import { StudioShellConflictError } from "../studio-shell/StudioShellApplicationErrors";
import {
  createToolAssetMetadata,
  createToolStudioTaxonomy,
  ToolStudioIdentity,
} from "../../domain/tool-studio/ToolStudioDomain";

export interface EnsureToolStudioResult {
  readonly initialized: boolean;
  readonly studio: StudioInitializationResult["studio"];
  readonly session: StudioInitializationResult["activeSession"];
}

export interface CreateToolDraftCommand {
  readonly studioId?: string;
  readonly sessionId: string;
  readonly title: string;
  readonly summary?: string;
  readonly content: string;
  readonly tags?: ReadonlyArray<string>;
  readonly creatorId?: string;
  readonly behaviorKind?: "deterministic" | "conditional";
  readonly dependencies?: ReadonlyArray<AssetDraftDependencyReference>;
}

export interface PublishToolDraftCommand {
  readonly studioId?: string;
  readonly sessionId: string;
  readonly draftId: string;
  readonly versionId?: string;
  readonly versionLabel?: string;
  readonly createdBy?: string;
}

export class ToolStudioApplicationService {
  constructor(
    private readonly studioShellService: StudioShellApplicationService,
    private readonly contractResolver: Pick<IAssetContractResolver, "resolveContractForTaxonomy"> = new CompositionAssetContractResolver(),
  ) {}

  public async ensureStudioInitialized(
    studioId: string = ToolStudioIdentity.defaultStudioId,
    studioName: string = ToolStudioIdentity.defaultStudioName,
  ): Promise<EnsureToolStudioResult> {
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

  public async createToolDraft(command: CreateToolDraftCommand): Promise<AssetDraftResult> {
    const studioId = command.studioId?.trim() || ToolStudioIdentity.defaultStudioId;
    const taxonomy = createToolStudioTaxonomy(command.behaviorKind);
    const contract = this.contractResolver.resolveContractForTaxonomy(taxonomy);

    return this.studioShellService.createAssetDraft({
      studioId,
      sessionId: command.sessionId,
      content: command.content,
      metadata: createToolAssetMetadata({
        title: command.title,
        summary: command.summary,
        tags: command.tags,
        creatorId: command.creatorId,
        behaviorKind: command.behaviorKind,
        contract,
      }),
      dependencies: command.dependencies,
    });
  }

  public async publishToolDraft(command: PublishToolDraftCommand): Promise<AssetVersionResult> {
    const studioId = command.studioId?.trim() || ToolStudioIdentity.defaultStudioId;
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
