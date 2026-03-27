import {
  attachDraftToSession,
  createAssetDraft,
  createAssetSession,
  publishAssetDraftVersion,
  StudioShellDraftLifecycleTransitionError,
  StudioShellDraftLifecyclePublishGateError,
  createStudio,
  transitionAssetDraftLifecycle,
  updateAssetDraft,
  withStudioSession,
} from "../../domain/studio-shell/StudioShellDomain";
import type { AssetDraft } from "../../domain/studio-shell/StudioShellDomain";
import type { IStudioShellRepository } from "../ports/interfaces/IStudioShellRepository";
import {
  StudioShellConflictError,
  StudioShellInvalidLifecycleTransitionError,
  StudioShellInvalidRequestError,
  StudioShellNotFoundError,
} from "./StudioShellApplicationErrors";
import type {
  AssetDraftResult,
  AssetVersionHistoryResult,
  AssetVersionResult,
  CreateAssetDraftCommand,
  InitializeStudioCommand,
  ListAssetDraftVersionHistoryQuery,
  LoadAssetDraftQuery,
  PublishAssetDraftVersionCommand,
  StartAssetSessionCommand,
  StudioInitializationResult,
  StudioSessionResult,
  TransitionAssetDraftLifecycleCommand,
  UpdateAssetDraftCommand,
  UpdateAssetDraftDependenciesCommand,
} from "./contracts";
import type { StudioShellApplicationService } from "./StudioShellApplicationService";

function defaultCreateId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function assertRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new StudioShellInvalidRequestError(`${label} is required.`);
  }
  return normalized;
}

function asInvalidRequest(error: unknown): never {
  if (error instanceof StudioShellInvalidRequestError || error instanceof StudioShellNotFoundError || error instanceof StudioShellConflictError) {
    throw error;
  }

  if (error instanceof Error) {
    throw new StudioShellInvalidRequestError(error.message);
  }

  throw new StudioShellInvalidRequestError("Studio shell request could not be processed.");
}

function asLifecycleTransition(error: unknown): never {
  if (error instanceof StudioShellDraftLifecycleTransitionError || error instanceof StudioShellDraftLifecyclePublishGateError) {
    throw new StudioShellInvalidLifecycleTransitionError(error.message);
  }

  asInvalidRequest(error);
}

export class DefaultStudioShellApplicationService implements StudioShellApplicationService {
  constructor(
    private readonly repository: IStudioShellRepository,
    private readonly createId: (prefix: "session" | "draft" | "version") => string = defaultCreateId,
  ) {}

  public async initializeStudio(command: InitializeStudioCommand): Promise<StudioInitializationResult> {
    const studioId = assertRequired(command.studioId, "Studio id");
    const existing = await this.repository.getStudio(studioId);
    if (existing) {
      throw new StudioShellConflictError(`Studio '${studioId}' already exists.`);
    }

    const studio = createStudio({
      id: studioId,
      name: command.name,
    });
    const session = createAssetSession({
      id: this.createId("session"),
      studioId: studio.id,
    });
    const studioWithSession = withStudioSession(studio, session.id);

    await this.repository.saveSession(session);
    await this.repository.saveStudio(studioWithSession);

    return Object.freeze({
      studio: studioWithSession,
      activeSession: session,
    });
  }

  public async startAssetSession(command: StartAssetSessionCommand): Promise<StudioSessionResult> {
    const studioId = assertRequired(command.studioId, "Studio id");
    const studio = await this.requireStudio(studioId);

    const session = createAssetSession({
      id: command.sessionId?.trim() || this.createId("session"),
      studioId,
    });

    const updatedStudio = withStudioSession(studio, session.id);
    await this.repository.saveSession(session);
    await this.repository.saveStudio(updatedStudio);

    return Object.freeze({
      studio: updatedStudio,
      session,
      drafts: Object.freeze([]),
    });
  }

  public async createAssetDraft(command: CreateAssetDraftCommand): Promise<AssetDraftResult> {
    const studioId = assertRequired(command.studioId, "Studio id");
    const sessionId = assertRequired(command.sessionId, "Session id");

    const studio = await this.requireStudio(studioId);
    const session = await this.requireSession(sessionId);
    if (session.studioId !== studioId) {
      throw new StudioShellInvalidRequestError(`Session '${sessionId}' does not belong to studio '${studioId}'.`);
    }

    let draft: AssetDraft;
    try {
      draft = createAssetDraft({
        id: command.draftId?.trim() || this.createId("draft"),
        studioId,
        session,
        content: command.content,
        metadata: command.metadata,
        dependencies: command.dependencies,
      });
    } catch (error) {
      asInvalidRequest(error);
    }

    const updatedSession = attachDraftToSession(session, draft);
    await this.repository.saveDraft(draft);
    await this.repository.saveSession(updatedSession);

    return Object.freeze({
      studio,
      session: updatedSession,
      draft,
    });
  }

  public async loadAssetDraft(query: LoadAssetDraftQuery): Promise<AssetDraftResult | undefined> {
    const studioId = assertRequired(query.studioId, "Studio id");
    const draftId = assertRequired(query.draftId, "Draft id");

    const studio = await this.repository.getStudio(studioId);
    if (!studio) {
      return undefined;
    }

    const draft = await this.repository.getDraft(draftId);
    if (!draft || draft.studioId !== studioId) {
      return undefined;
    }

    const session = await this.repository.getSession(draft.sessionId);
    if (!session) {
      throw new StudioShellNotFoundError("session", draft.sessionId);
    }

    return Object.freeze({
      studio,
      session,
      draft,
    });
  }

  public async updateAssetDraft(command: UpdateAssetDraftCommand): Promise<AssetDraftResult> {
    const studioId = assertRequired(command.studioId, "Studio id");
    const sessionId = assertRequired(command.sessionId, "Session id");
    const draftId = assertRequired(command.draftId, "Draft id");

    const studio = await this.requireStudio(studioId);
    const session = await this.requireSession(sessionId);
    const draft = await this.requireDraft(draftId);

    if (session.studioId !== studio.id) {
      throw new StudioShellInvalidRequestError(`Session '${session.id}' does not belong to studio '${studio.id}'.`);
    }

    if (draft.studioId !== studio.id) {
      throw new StudioShellInvalidRequestError(`Draft '${draft.id}' does not belong to studio '${studio.id}'.`);
    }

    let updatedDraft: AssetDraft;
    try {
      updatedDraft = updateAssetDraft(draft, session, {
        content: command.content,
        metadata: command.metadata,
        metadataPatch: command.metadataPatch,
      });
    } catch (error) {
      asInvalidRequest(error);
    }

    const updatedSession = attachDraftToSession(session, updatedDraft);
    await this.repository.saveDraft(updatedDraft);
    await this.repository.saveSession(updatedSession);

    return Object.freeze({
      studio,
      session: updatedSession,
      draft: updatedDraft,
    });
  }

  public async updateAssetDraftDependencies(command: UpdateAssetDraftDependenciesCommand): Promise<AssetDraftResult> {
    const studioId = assertRequired(command.studioId, "Studio id");
    const sessionId = assertRequired(command.sessionId, "Session id");
    const draftId = assertRequired(command.draftId, "Draft id");

    const studio = await this.requireStudio(studioId);
    const session = await this.requireSession(sessionId);
    const draft = await this.requireDraft(draftId);

    if (session.studioId !== studio.id) {
      throw new StudioShellInvalidRequestError(`Session '${session.id}' does not belong to studio '${studio.id}'.`);
    }

    if (draft.studioId !== studio.id) {
      throw new StudioShellInvalidRequestError(`Draft '${draft.id}' does not belong to studio '${studio.id}'.`);
    }

    let updatedDraft: AssetDraft;
    try {
      updatedDraft = updateAssetDraft(draft, session, {
        dependencies: command.dependencies,
      });
    } catch (error) {
      asInvalidRequest(error);
    }

    const updatedSession = attachDraftToSession(session, updatedDraft);
    await this.repository.saveDraft(updatedDraft);
    await this.repository.saveSession(updatedSession);

    return Object.freeze({
      studio,
      session: updatedSession,
      draft: updatedDraft,
    });
  }

  public async transitionAssetDraftLifecycle(command: TransitionAssetDraftLifecycleCommand): Promise<AssetDraftResult> {
    const studioId = assertRequired(command.studioId, "Studio id");
    const sessionId = assertRequired(command.sessionId, "Session id");
    const draftId = assertRequired(command.draftId, "Draft id");

    const studio = await this.requireStudio(studioId);
    const session = await this.requireSession(sessionId);
    const draft = await this.requireDraft(draftId);

    if (session.studioId !== studio.id) {
      throw new StudioShellInvalidRequestError(`Session '${session.id}' does not belong to studio '${studio.id}'.`);
    }

    if (draft.studioId !== studio.id) {
      throw new StudioShellInvalidRequestError(`Draft '${draft.id}' does not belong to studio '${studio.id}'.`);
    }

    let updatedDraft: AssetDraft;
    try {
      updatedDraft = transitionAssetDraftLifecycle(draft, session, command.targetStatus);
    } catch (error) {
      asLifecycleTransition(error);
    }

    const updatedSession = attachDraftToSession(session, updatedDraft);
    await this.repository.saveDraft(updatedDraft);
    await this.repository.saveSession(updatedSession);

    return Object.freeze({
      studio,
      session: updatedSession,
      draft: updatedDraft,
    });
  }

  public async publishAssetDraftVersion(command: PublishAssetDraftVersionCommand): Promise<AssetVersionResult> {
    const studioId = assertRequired(command.studioId, "Studio id");
    const sessionId = assertRequired(command.sessionId, "Session id");
    const draftId = assertRequired(command.draftId, "Draft id");
    const versionId = command.versionId?.trim() || this.createId("version");

    const studio = await this.requireStudio(studioId);
    const session = await this.requireSession(sessionId);
    const draft = await this.requireDraft(draftId);

    if (session.studioId !== studio.id) {
      throw new StudioShellInvalidRequestError(`Session '${session.id}' does not belong to studio '${studio.id}'.`);
    }

    if (draft.studioId !== studio.id) {
      throw new StudioShellInvalidRequestError(`Draft '${draft.id}' does not belong to studio '${studio.id}'.`);
    }

    const existingVersion = await this.repository.getAssetVersion(versionId);
    if (existingVersion) {
      throw new StudioShellConflictError(`Asset version '${versionId}' already exists and is immutable.`);
    }

    let published: ReturnType<typeof publishAssetDraftVersion>;
    try {
      published = publishAssetDraftVersion({
        draft,
        session,
        versionId,
        versionLabel: command.versionLabel,
        parentVersionId: command.parentVersionId,
        createdBy: command.createdBy,
        upstreamVersionIds: command.upstreamVersionIds,
      });
    } catch (error) {
      asLifecycleTransition(error);
    }
    const updatedSession = attachDraftToSession(session, published.draft);

    await this.repository.saveAssetVersion(published.version);
    await this.repository.saveDraft(published.draft);
    await this.repository.saveSession(updatedSession);

    return Object.freeze({
      studio,
      session: updatedSession,
      draft: published.draft,
      version: published.version,
    });
  }

  public async listAssetDraftVersionHistory(query: ListAssetDraftVersionHistoryQuery): Promise<AssetVersionHistoryResult> {
    const studioId = assertRequired(query.studioId, "Studio id");
    const draftId = assertRequired(query.draftId, "Draft id");
    const studio = await this.requireStudio(studioId);
    const draft = await this.requireDraft(draftId);
    if (draft.studioId !== studio.id) {
      throw new StudioShellInvalidRequestError(`Draft '${draft.id}' does not belong to studio '${studio.id}'.`);
    }

    const versions = await this.repository.listAssetVersionsByAssetId(draft.assetId);
    return Object.freeze({
      studio,
      draft,
      versions: Object.freeze([...versions].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())),
    });
  }

  private async requireStudio(studioId: string) {
    const studio = await this.repository.getStudio(studioId);
    if (!studio) {
      throw new StudioShellNotFoundError("studio", studioId);
    }
    return studio;
  }

  private async requireSession(sessionId: string) {
    const session = await this.repository.getSession(sessionId);
    if (!session) {
      throw new StudioShellNotFoundError("session", sessionId);
    }
    return session;
  }

  private async requireDraft(draftId: string) {
    const draft = await this.repository.getDraft(draftId);
    if (!draft) {
      throw new StudioShellNotFoundError("draft", draftId);
    }
    return draft;
  }
}
