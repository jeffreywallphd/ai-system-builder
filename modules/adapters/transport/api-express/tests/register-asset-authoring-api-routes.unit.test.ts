import { describe, expect, it, testDouble } from "../../../../testing/node-test";
import { registerAssetAuthoringApiRoutes } from "../asset-authoring/registerAssetAuthoringApiRoutes";

function response() {
  const json = testDouble.fn();
  const status = testDouble.fn();
  const res: any = { status: status.mockImplementation(() => res), json };
  return { res, json, status };
}

function appAndHandlers() {
  const handlers = new Map<string, any>();
  const app = {
    get: testDouble.fn((path, handler) => handlers.set(`GET ${path}`, handler)),
    post: testDouble.fn((path, handler) => handlers.set(`POST ${path}`, handler)),
    patch: testDouble.fn((path, handler) => handlers.set(`PATCH ${path}`, handler)),
  };
  return { app, handlers };
}

describe("registerAssetAuthoringApiRoutes", () => {
  it("registers the implemented Phase 8 authoring routes", () => {
    const { app } = appAndHandlers();
    registerAssetAuthoringApiRoutes({ app });
    expect(app.get.mock.calls.map((call: any) => call[0])).toEqual([
      "/api/asset-authoring/workspaces/:workspaceId/authored-assets",
      "/api/asset-authoring/workspaces/:workspaceId/authored-assets/:authoredAssetId",
      "/api/asset-authoring/workspaces/:workspaceId/drafts",
      "/api/asset-authoring/workspaces/:workspaceId/drafts/:draftId",
      "/api/asset-authoring/workspaces/:workspaceId/revisions",
      "/api/asset-authoring/workspaces/:workspaceId/revisions/:revisionId",
      "/api/asset-authoring/workspaces/:workspaceId/overrides",
      "/api/asset-authoring/workspaces/:workspaceId/overrides/:overrideId",
      "/api/asset-authoring/workspaces/:workspaceId/effective-summaries",
    ]);
  });

  it("maps route parameters and safe editable fields into draft commands", async () => {
    const { app, handlers } = appAndHandlers();
    const createAssetDraftUseCase = { execute: testDouble.fn(async (command) => ({ kind: "success", value: { draftId: "draft-1", ...command } })) };
    const publishAssetDraftUseCase = { execute: testDouble.fn(async (command) => ({ kind: "success", value: { revisionId: "revision-1", ...command } })) };
    registerAssetAuthoringApiRoutes({ app, createAssetDraftUseCase: createAssetDraftUseCase as any, publishAssetDraftUseCase: publishAssetDraftUseCase as any });

    const create = response();
    await handlers.get("POST /api/asset-authoring/workspaces/:workspaceId/drafts")(
      { params: { workspaceId: "workspace-a" }, body: { draftEditableValues: { "display-name": "Workflow", classification: "workflow-asset", tags: ["flow"] } } },
      create.res,
    );
    expect(create.status.mock.calls[0][0]).toBe(200);
    expect(createAssetDraftUseCase.execute.mock.calls[0][0]).toMatchObject({ targetWorkspaceId: "workspace-a", draftEditableValues: { "display-name": "Workflow", classification: "workflow-asset", tags: ["flow"] } });

    const publish = response();
    await handlers.get("POST /api/asset-authoring/workspaces/:workspaceId/drafts/:draftId/publish")(
      { params: { workspaceId: "workspace-a", draftId: "draft-1" }, body: {} },
      publish.res,
    );
    expect(publish.status.mock.calls[0][0]).toBe(200);
    expect(publishAssetDraftUseCase.execute.mock.calls[0][0]).toMatchObject({ targetWorkspaceId: "workspace-a", draftId: "draft-1" });
  });

  it("returns API-shaped list payloads for drafts and authored assets", async () => {
    const { app, handlers } = appAndHandlers();
    registerAssetAuthoringApiRoutes({
      app,
      authoredAssetRepository: { listAuthoredAssetRecords: testDouble.fn(async () => ({ records: [{ authoredAssetId: "asset-1" }], nextCursor: "next-asset" })) } as any,
      assetDraftRepository: { listAssetDraftRecords: testDouble.fn(async () => ({ records: [{ draftId: "draft-1" }], nextCursor: "next-draft" })) } as any,
    });

    const authored = response();
    await handlers.get("GET /api/asset-authoring/workspaces/:workspaceId/authored-assets")({ params: { workspaceId: "workspace-a" }, query: {} }, authored.res);
    expect(authored.json.mock.calls[0][0].value).toEqual({ assets: [{ authoredAssetId: "asset-1" }], nextCursor: "next-asset" });

    const drafts = response();
    await handlers.get("GET /api/asset-authoring/workspaces/:workspaceId/drafts")({ params: { workspaceId: "workspace-a" }, query: {} }, drafts.res);
    expect(drafts.json.mock.calls[0][0].value).toEqual({ drafts: [{ draftId: "draft-1" }], nextCursor: "next-draft" });
  });
});
