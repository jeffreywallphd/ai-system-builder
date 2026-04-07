import type { AssetVersion } from "@domain/assets/AssetVersion";
import type { AssetDraft, AssetSession, Studio } from "@domain/studio-shell/StudioShellDomain";
import type { IStudioShellRepository } from "@application/ports/interfaces/IStudioShellRepository";

export class InMemoryStudioShellRepository implements IStudioShellRepository {
  private readonly studios = new Map<string, Studio>();
  private readonly sessions = new Map<string, AssetSession>();
  private readonly drafts = new Map<string, AssetDraft>();
  private readonly versions = new Map<string, AssetVersion>();

  public async saveStudio(studio: Studio): Promise<Studio> {
    this.studios.set(studio.id, studio);
    return studio;
  }

  public async getStudio(studioId: string): Promise<Studio | undefined> {
    return this.studios.get(studioId);
  }

  public async saveSession(session: AssetSession): Promise<AssetSession> {
    this.sessions.set(session.id, session);
    return session;
  }

  public async getSession(sessionId: string): Promise<AssetSession | undefined> {
    return this.sessions.get(sessionId);
  }

  public async listStudioSessions(studioId: string): Promise<ReadonlyArray<AssetSession>> {
    return [...this.sessions.values()].filter((entry) => entry.studioId === studioId);
  }

  public async saveDraft(draft: AssetDraft): Promise<AssetDraft> {
    this.drafts.set(draft.id, draft);
    return draft;
  }

  public async getDraft(draftId: string): Promise<AssetDraft | undefined> {
    return this.drafts.get(draftId);
  }

  public async listSessionDrafts(sessionId: string): Promise<ReadonlyArray<AssetDraft>> {
    return [...this.drafts.values()].filter((entry) => entry.sessionId === sessionId);
  }

  public async saveAssetVersion(version: AssetVersion): Promise<AssetVersion> {
    this.versions.set(version.versionId, version);
    return version;
  }

  public async getAssetVersion(versionId: string): Promise<AssetVersion | undefined> {
    return this.versions.get(versionId);
  }

  public async listAssetVersionsByAssetId(assetId: string): Promise<ReadonlyArray<AssetVersion>> {
    return [...this.versions.values()].filter((entry) => entry.assetId.value === assetId);
  }
}

