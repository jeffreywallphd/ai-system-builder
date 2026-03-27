import type { AssetDraft, AssetSession, Studio } from "../../../domain/studio-shell/StudioShellDomain";

export interface IStudioShellRepository {
  saveStudio(studio: Studio): Promise<Studio>;
  getStudio(studioId: string): Promise<Studio | undefined>;

  saveSession(session: AssetSession): Promise<AssetSession>;
  getSession(sessionId: string): Promise<AssetSession | undefined>;
  listStudioSessions(studioId: string): Promise<ReadonlyArray<AssetSession>>;

  saveDraft(draft: AssetDraft): Promise<AssetDraft>;
  getDraft(draftId: string): Promise<AssetDraft | undefined>;
  listSessionDrafts(sessionId: string): Promise<ReadonlyArray<AssetDraft>>;
}
