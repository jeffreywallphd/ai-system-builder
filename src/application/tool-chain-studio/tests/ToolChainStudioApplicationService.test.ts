import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../ports/interfaces/IStudioShellRepository";
import type { AssetDraft, AssetSession, Studio } from "@domain/studio-shell/StudioShellDomain";
import type { AssetVersion } from "@domain/assets/AssetVersion";
import { DefaultStudioShellApplicationService } from "../../studio-shell/DefaultStudioShellApplicationService";
import { ToolChainStudioApplicationService } from "../ToolChainStudioApplicationService";
import { ToolChainStudioIdentity } from "@domain/tool-chain-studio/ToolChainStudioDomain";

class InMemoryStudioShellRepository implements IStudioShellRepository {
  private readonly studios = new Map<string, Studio>();
  private readonly sessions = new Map<string, AssetSession>();
  private readonly drafts = new Map<string, AssetDraft>();
  private readonly versions = new Map<string, AssetVersion>();

  async saveStudio(studio: Studio): Promise<Studio> { this.studios.set(studio.id, studio); return studio; }
  async getStudio(studioId: string): Promise<Studio | undefined> { return this.studios.get(studioId); }
  async saveSession(session: AssetSession): Promise<AssetSession> { this.sessions.set(session.id, session); return session; }
  async getSession(sessionId: string): Promise<AssetSession | undefined> { return this.sessions.get(sessionId); }
  async listStudioSessions(studioId: string): Promise<ReadonlyArray<AssetSession>> { return [...this.sessions.values()].filter((entry) => entry.studioId === studioId); }
  async saveDraft(draft: AssetDraft): Promise<AssetDraft> { this.drafts.set(draft.id, draft); return draft; }
  async getDraft(draftId: string): Promise<AssetDraft | undefined> { return this.drafts.get(draftId); }
  async listSessionDrafts(sessionId: string): Promise<ReadonlyArray<AssetDraft>> { return [...this.drafts.values()].filter((entry) => entry.sessionId === sessionId); }
  async saveAssetVersion(version: AssetVersion): Promise<AssetVersion> { this.versions.set(version.versionId, version); return version; }
  async getAssetVersion(versionId: string): Promise<AssetVersion | undefined> { return this.versions.get(versionId); }
  async listAssetVersionsByAssetId(assetId: string): Promise<ReadonlyArray<AssetVersion>> { return [...this.versions.values()].filter((entry) => entry.assetId.value === assetId); }
}

describe("ToolChainStudioApplicationService", () => {
  it("authors tool-chain drafts with composite taxonomy and shared contract/provenance defaults", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1", "version-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new ToolChainStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createToolChainDraft({
      sessionId: ensure.session.id,
      title: "Tool Chain Draft",
      content: '{"toolChainSpec":{"steps":[{"id":"lookup-customer","toolRef":"tool:crm-lookup:v3","kind":"tool-invocation","provider":"mcp","arguments":{"customerId":"${input.customerId}"}},{"id":"score-risk","toolRef":"tool:risk-score:v4","kind":"tool-invocation","provider":"local","arguments":{"profile":"${steps.lookup-customer.output.profile}"}}],"output":{"strategy":"last-step"}}}',
      creatorId: "author-1",
      tags: ["tool-orchestration", "mcp", "multi-step", "tool-invocation"],
      dependencies: [
        { assetId: "asset:tool-crm-lookup", versionId: "asset:tool-crm-lookup:v3" },
        { assetId: "asset:tool-risk-score", versionId: "asset:tool-risk-score:v4" },
      ],
    });

    expect(ensure.studio.id).toBe(ToolChainStudioIdentity.defaultStudioId);
    expect(created.draft.metadata.taxonomy?.structuralKind).toBe("composite");
    expect(created.draft.metadata.taxonomy?.semanticRole).toBe("tool-chain");
    expect(created.draft.metadata.taxonomy?.behaviorKind).toBe("deterministic");
    expect(created.draft.metadata.contract?.version).toBe("1.0.0");
    expect(created.draft.metadata.contract?.parameters.find((parameter) => parameter.id === "executionOrdering")?.defaultValue).toBe("sequential");
    expect(created.draft.metadata.provenance?.sourceType).toBe("generated");
    expect(created.draft.metadata.provenance?.creatorId).toBe("author-1");
    expect(created.draft.metadata.tags).toEqual([
      "tool-chain",
      "tool-orchestration",
      "mcp",
      "multi-step",
      "tool-invocation",
    ]);
  });

  it("reuses shared lifecycle/version flow when publishing tool-chain drafts", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new ToolChainStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createToolChainDraft({
      sessionId: ensure.session.id,
      title: "Tool Chain Draft",
      content: "{}",
      dependencies: [{ assetId: "asset:tool", versionId: "asset:tool:v9" }],
    });

    const published = await service.publishToolChainDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "tool-chain-version-1",
      versionLabel: "v1",
    });

    expect(published.version.versionId).toBe("tool-chain-version-1");
    expect(published.version.assetId.value).toBe(created.draft.assetId);
    expect(published.draft.lifecycleStatus).toBe("published");
    expect(published.draft.publishedVersionIds).toEqual(["tool-chain-version-1"]);
  });

  it("blocks publish when tool-chain draft taxonomy semantic role drifts outside composite tool-chain expectations", async () => {
    const repository = new InMemoryStudioShellRepository();
    const ids = ["session-1", "draft-1"];
    const studioShell = new DefaultStudioShellApplicationService(repository, () => ids.shift() ?? "generated");
    const service = new ToolChainStudioApplicationService(studioShell);

    const ensure = await service.ensureStudioInitialized();
    const created = await service.createToolChainDraft({
      sessionId: ensure.session.id,
      title: "Tool Chain",
      content: "{}",
      dependencies: [{ assetId: "asset:tool", versionId: "asset:tool:v1" }],
    });

    await studioShell.updateAssetDraft({
      studioId: ToolChainStudioIdentity.defaultStudioId,
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      metadataPatch: {
        taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
      },
    });

    await expect(service.publishToolChainDraft({
      sessionId: ensure.session.id,
      draftId: created.draft.id,
      versionId: "tool-chain-version-invalid",
    })).rejects.toThrow("taxonomy-semantic-role-mismatch");
  });
});

