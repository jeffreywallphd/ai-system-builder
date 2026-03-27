import type { AssetDraftLifecycleStatus, AssetMetadata, AssetMetadataPatch } from "../../../domain/studio-shell/StudioShellDomain";
import type { IStudioShellRepository } from "../../../application/ports/interfaces/IStudioShellRepository";
import { DefaultStudioShellApplicationService } from "../../../application/studio-shell/DefaultStudioShellApplicationService";
import {
  buildStudioShellValidationIssues,
  tryReadTaxonomyFromVersionMetadata,
  type StudioShellValidationIssue,
} from "../../../application/studio-shell/StudioShellValidation";
import type {
  CreateAssetDraftCommand,
  PublishAssetDraftVersionCommand,
  TransitionAssetDraftLifecycleCommand,
  UpdateAssetDraftCommand,
  UpdateAssetDraftDependenciesCommand,
} from "../../../application/studio-shell/contracts";
import {
  StudioShellApplicationError,
  StudioShellErrorCodes,
  StudioShellInvalidRequestError,
} from "../../../application/studio-shell/StudioShellApplicationErrors";

export interface StudioShellApiError {
  readonly code: "not-found" | "conflict" | "invalid-request" | "invalid-lifecycle-transition" | "validation-failed" | "internal";
  readonly message: string;
  readonly validationIssues?: ReadonlyArray<StudioShellValidationIssue>;
}

export interface StudioShellApiResponse<T> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: StudioShellApiError;
}

export interface StudioShellSnapshotReadModel {
  readonly studioId: string;
  readonly studioName: string;
  readonly activeSessionId?: string;
  readonly sessionStatus?: string;
  readonly draft?: {
    readonly draftId: string;
    readonly assetId: string;
    readonly content: string;
    readonly revision: number;
    readonly lifecycleStatus: AssetDraftLifecycleStatus;
    readonly metadata: AssetMetadata;
    readonly dependencies: ReadonlyArray<{ readonly assetId: string; readonly versionId?: string }>;
    readonly publishedVersionIds: ReadonlyArray<string>;
    readonly lastPublishedVersionId?: string;
    readonly createdAt: string;
    readonly updatedAt: string;
  };
  readonly versions: ReadonlyArray<{
    readonly versionId: string;
    readonly versionLabel?: string;
    readonly createdAt: string;
    readonly parentVersionId?: string;
  }>;
  readonly validationIssues: ReadonlyArray<StudioShellValidationIssue>;
}

export interface ValidateStudioShellDraftRequest {
  readonly studioId: string;
  readonly draftId: string;
}

export class StudioShellBackendApi {
  private readonly service: DefaultStudioShellApplicationService;

  constructor(private readonly repository: IStudioShellRepository) {
    this.service = new DefaultStudioShellApplicationService(repository);
  }

  public async initializeStudio(studioId: string, name: string): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    return this.wrap(async () => {
      await this.service.initializeStudio({ studioId, name });
      return this.requireSnapshot(studioId);
    });
  }

  public async loadSnapshot(studioId: string): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel | undefined>> {
    return this.wrap(async () => {
      const studio = await this.repository.getStudio(studioId.trim());
      if (!studio) {
        return undefined;
      }
      return this.requireSnapshot(studio.id);
    });
  }

  public async startSession(studioId: string): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    return this.wrap(async () => {
      await this.service.startAssetSession({ studioId });
      return this.requireSnapshot(studioId);
    });
  }

  public async createDraft(command: CreateAssetDraftCommand): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    return this.wrap(async () => {
      await this.service.createAssetDraft(command);
      return this.requireSnapshot(command.studioId);
    });
  }

  public async updateDraft(command: UpdateAssetDraftCommand): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    return this.wrap(async () => {
      await this.service.updateAssetDraft(command);
      return this.requireSnapshot(command.studioId);
    });
  }

  public async updateDependencies(command: UpdateAssetDraftDependenciesCommand): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    return this.wrap(async () => {
      await this.service.updateAssetDraftDependencies(command);
      return this.requireSnapshot(command.studioId);
    });
  }

  public async transitionLifecycle(command: TransitionAssetDraftLifecycleCommand): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    return this.wrap(async () => {
      await this.service.transitionAssetDraftLifecycle(command);
      return this.requireSnapshot(command.studioId);
    });
  }

  public async publishVersion(command: PublishAssetDraftVersionCommand): Promise<StudioShellApiResponse<StudioShellSnapshotReadModel>> {
    return this.wrap(async () => {
      await this.service.publishAssetDraftVersion(command);
      return this.requireSnapshot(command.studioId);
    });
  }

  public async validateDraft(request: ValidateStudioShellDraftRequest): Promise<StudioShellApiResponse<ReadonlyArray<StudioShellValidationIssue>>> {
    return this.wrap(async () => {
      const snapshot = await this.requireSnapshot(request.studioId);
      if (snapshot.draft?.draftId !== request.draftId) {
        throw new StudioShellInvalidRequestError(`Draft '${request.draftId}' is not the active draft for studio '${request.studioId}'.`);
      }
      return snapshot.validationIssues;
    });
  }

  private async requireSnapshot(studioId: string): Promise<StudioShellSnapshotReadModel> {
    const studio = await this.repository.getStudio(studioId.trim());
    if (!studio) {
      throw new StudioShellInvalidRequestError(`Studio '${studioId}' does not exist.`);
    }
    const activeSession = studio.activeSessionId ? await this.repository.getSession(studio.activeSessionId) : undefined;
    const activeDraft = activeSession?.currentDraftId ? await this.repository.getDraft(activeSession.currentDraftId) : undefined;
    const versions = activeDraft
      ? await this.repository.listAssetVersionsByAssetId(activeDraft.assetId)
      : Object.freeze([]);
    const validationIssues = activeDraft
      ? await buildStudioShellValidationIssues({
        draft: activeDraft,
        knownVersionIds: versions.map((entry) => entry.versionId),
        versionExists: async (versionId) => Boolean(await this.repository.getAssetVersion(versionId)),
        resolveDependencyVersion: async (versionId) => {
          const version = await this.repository.getAssetVersion(versionId);
          if (!version) {
            return undefined;
          }
          return Object.freeze({
            assetId: version.assetId.value,
            taxonomy: tryReadTaxonomyFromVersionMetadata(version.metadata),
          });
        },
      })
      : Object.freeze([]);

    return Object.freeze({
      studioId: studio.id,
      studioName: studio.name,
      activeSessionId: activeSession?.id,
      sessionStatus: activeSession?.status,
      draft: activeDraft
        ? Object.freeze({
          draftId: activeDraft.id,
          assetId: activeDraft.assetId,
          content: activeDraft.content,
          revision: activeDraft.revision,
          lifecycleStatus: activeDraft.lifecycleStatus,
          metadata: activeDraft.metadata,
          dependencies: activeDraft.dependencies,
          publishedVersionIds: activeDraft.publishedVersionIds,
          lastPublishedVersionId: activeDraft.lastPublishedVersionId,
          createdAt: activeDraft.createdAt,
          updatedAt: activeDraft.updatedAt,
        })
        : undefined,
      versions: Object.freeze(
        [...versions]
          .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
          .map((entry) => Object.freeze({
            versionId: entry.versionId,
            versionLabel: entry.versionLabel,
            parentVersionId: entry.parentVersionId,
            createdAt: entry.createdAt.toISOString(),
          })),
      ),
      validationIssues,
    });
  }

  private async wrap<T>(action: () => Promise<T>): Promise<StudioShellApiResponse<T>> {
    try {
      return Object.freeze({ ok: true, data: await action() });
    } catch (error) {
      return Object.freeze({ ok: false, error: this.toApiError(error) });
    }
  }

  private toApiError(error: unknown): StudioShellApiError {
    if (error instanceof StudioShellApplicationError) {
      const codeMap: Record<string, StudioShellApiError["code"]> = {
        [StudioShellErrorCodes.notFound]: "not-found",
        [StudioShellErrorCodes.conflict]: "conflict",
        [StudioShellErrorCodes.invalidLifecycleTransition]: "invalid-lifecycle-transition",
        [StudioShellErrorCodes.invalidRequest]: "invalid-request",
      };
      return Object.freeze({
        code: codeMap[error.code] ?? "invalid-request",
        message: error.message,
      });
    }

    const message = error instanceof Error ? error.message : "Unexpected backend error.";
    return Object.freeze({
      code: "internal",
      message,
    });
  }
}
