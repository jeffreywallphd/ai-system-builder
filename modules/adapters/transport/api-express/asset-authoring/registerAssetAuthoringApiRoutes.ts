import type { WorkspaceAssetAuthoringReadModelService } from "../../../../application/services/asset/workspace-asset-authoring-read-model.service";
import type { AuthoredAssetRepositoryPort, AssetDraftRepositoryPort, AssetOverrideRepositoryPort, AssetRevisionRepositoryPort } from "../../../../application/ports/asset-authoring";
import type { CreateWorkspaceAuthoredAssetUseCase, CreateAssetDraftUseCase, UpdateAssetDraftUseCase, PublishAssetDraftUseCase, CreateAssetOverrideUseCase, UpdateAssetOverrideUseCase, DisableAssetOverrideUseCase } from "../../../../application/use-cases/asset-authoring";
import { createApiAssetAuthoringFailureResponse, createApiAssetAuthoringOperationSuccessResponse, API_ASSET_AUTHORING_CREATE_WORKSPACE_AUTHORED_ASSET_OPERATION, API_ASSET_AUTHORING_CREATE_DRAFT_OPERATION, API_ASSET_AUTHORING_UPDATE_DRAFT_OPERATION, API_ASSET_AUTHORING_PUBLISH_DRAFT_OPERATION, API_ASSET_AUTHORING_CREATE_OVERRIDE_OPERATION, API_ASSET_AUTHORING_UPDATE_OVERRIDE_OPERATION, API_ASSET_AUTHORING_DISABLE_OVERRIDE_OPERATION, API_ASSET_AUTHORING_LIST_AUTHORED_ASSETS_OPERATION, API_ASSET_AUTHORING_READ_AUTHORED_ASSET_OPERATION, API_ASSET_AUTHORING_LIST_DRAFTS_OPERATION, API_ASSET_AUTHORING_READ_DRAFT_OPERATION, API_ASSET_AUTHORING_LIST_REVISIONS_OPERATION, API_ASSET_AUTHORING_READ_REVISION_OPERATION, API_ASSET_AUTHORING_LIST_OVERRIDES_OPERATION, API_ASSET_AUTHORING_READ_OVERRIDE_OPERATION, API_ASSET_AUTHORING_LIST_EFFECTIVE_SUMMARIES_OPERATION } from "../../../../contracts/api";

interface App { get: (p: string, h: any) => void; post: (p: string, h: any) => void; patch: (p: string, h: any) => void; }
const asString = (v: unknown) => typeof v === "string" ? v.trim() : "";
const asLimit = (v: unknown) => Math.max(1, Math.min(100, Number.isFinite(Number(v)) ? Number(v) : 25));
const fail = (res: any, op: string, code: any, status: number, message: string) => res.status(status).json(createApiAssetAuthoringFailureResponse(op, code, message));

export interface RegisterAssetAuthoringApiRoutesDependencies { app: App; createWorkspaceAuthoredAssetUseCase?: CreateWorkspaceAuthoredAssetUseCase; createAssetDraftUseCase?: CreateAssetDraftUseCase; updateAssetDraftUseCase?: UpdateAssetDraftUseCase; publishAssetDraftUseCase?: PublishAssetDraftUseCase; createAssetOverrideUseCase?: CreateAssetOverrideUseCase; updateAssetOverrideUseCase?: UpdateAssetOverrideUseCase; disableAssetOverrideUseCase?: DisableAssetOverrideUseCase; authoredAssetRepository?: AuthoredAssetRepositoryPort; assetDraftRepository?: AssetDraftRepositoryPort; assetRevisionRepository?: AssetRevisionRepositoryPort; assetOverrideRepository?: AssetOverrideRepositoryPort; effectiveSummaryReader?: WorkspaceAssetAuthoringReadModelService; }
export function registerAssetAuthoringApiRoutes(d: RegisterAssetAuthoringApiRoutesDependencies): void {
  const cmd = (method: "post" | "patch", path: string, op: string, uc: any, workspaceField: string) => d.app[method](path, async (req: any, res: any) => {
    const workspaceId = asString(req.params?.workspaceId);
    if (!workspaceId) return fail(res, op, "validation", 400, "workspaceId is required.");
    if (!uc) return fail(res, op, "unavailable", 503, "Operation unavailable.");
    const payload = { ...(req.body ?? {}), [workspaceField]: workspaceId };
    if (req.body?.[workspaceField] && asString(req.body[workspaceField]) !== workspaceId) return fail(res, op, "validation", 400, "workspace route/body mismatch.");
    try { const r = await uc.execute(payload); if (r.kind === "failure") return fail(res, op, r.failure.code, r.failure.code === "unavailable" ? 503 : 400, r.failure.message); return res.status(200).json(createApiAssetAuthoringOperationSuccessResponse(op, r.value)); }
    catch { return fail(res, op, "internal", 500, "Operation failed."); }
  });

  cmd("post", "/api/asset-authoring/workspaces/:workspaceId/authored-assets", API_ASSET_AUTHORING_CREATE_WORKSPACE_AUTHORED_ASSET_OPERATION, d.createWorkspaceAuthoredAssetUseCase, "workspaceId");
  cmd("post", "/api/asset-authoring/workspaces/:workspaceId/drafts", API_ASSET_AUTHORING_CREATE_DRAFT_OPERATION, d.createAssetDraftUseCase, "targetWorkspaceId");
  cmd("patch", "/api/asset-authoring/workspaces/:workspaceId/drafts/:draftId", API_ASSET_AUTHORING_UPDATE_DRAFT_OPERATION, d.updateAssetDraftUseCase, "targetWorkspaceId");
  cmd("post", "/api/asset-authoring/workspaces/:workspaceId/drafts/:draftId/publish", API_ASSET_AUTHORING_PUBLISH_DRAFT_OPERATION, d.publishAssetDraftUseCase, "targetWorkspaceId");
  cmd("post", "/api/asset-authoring/workspaces/:workspaceId/overrides", API_ASSET_AUTHORING_CREATE_OVERRIDE_OPERATION, d.createAssetOverrideUseCase, "targetWorkspaceId");
  cmd("patch", "/api/asset-authoring/workspaces/:workspaceId/overrides/:overrideId", API_ASSET_AUTHORING_UPDATE_OVERRIDE_OPERATION, d.updateAssetOverrideUseCase, "targetWorkspaceId");
  cmd("post", "/api/asset-authoring/workspaces/:workspaceId/overrides/:overrideId/disable", API_ASSET_AUTHORING_DISABLE_OVERRIDE_OPERATION, d.disableAssetOverrideUseCase, "targetWorkspaceId");

  d.app.get("/api/asset-authoring/workspaces/:workspaceId/authored-assets", async (req: any, res: any) => {
    if (!d.authoredAssetRepository) return fail(res, API_ASSET_AUTHORING_LIST_AUTHORED_ASSETS_OPERATION, "unavailable", 503, "Read unavailable.");
    const workspaceId = asString(req.params?.workspaceId); if (!workspaceId) return fail(res, API_ASSET_AUTHORING_LIST_AUTHORED_ASSETS_OPERATION, "validation", 400, "workspaceId is required.");
    const result = await d.authoredAssetRepository.listAuthoredAssetRecords({ workspaceId: workspaceId as never, status: asString(req.query?.status) as never, limit: asLimit(req.query?.limit), cursor: asString(req.query?.cursor) || undefined });
    return res.status(200).json(createApiAssetAuthoringOperationSuccessResponse(API_ASSET_AUTHORING_LIST_AUTHORED_ASSETS_OPERATION, result));
  });
  d.app.get("/api/asset-authoring/workspaces/:workspaceId/authored-assets/:authoredAssetId", async (req: any, res: any) => {
    if (!d.authoredAssetRepository) return fail(res, API_ASSET_AUTHORING_READ_AUTHORED_ASSET_OPERATION, "unavailable", 503, "Read unavailable.");
    const item = await d.authoredAssetRepository.readAuthoredAssetRecordByWorkspace(asString(req.params.workspaceId) as never, asString(req.params.authoredAssetId) as never);
    return res.status(200).json(createApiAssetAuthoringOperationSuccessResponse(API_ASSET_AUTHORING_READ_AUTHORED_ASSET_OPERATION, item));
  });
  d.app.get("/api/asset-authoring/workspaces/:workspaceId/drafts", async (req: any, res: any) => res.status(200).json(createApiAssetAuthoringOperationSuccessResponse(API_ASSET_AUTHORING_LIST_DRAFTS_OPERATION, await d.assetDraftRepository?.listAssetDraftRecords({ workspaceId: asString(req.params.workspaceId) as never, status: asString(req.query?.status) as never, limit: asLimit(req.query?.limit), cursor: asString(req.query?.cursor) || undefined }))));
  d.app.get("/api/asset-authoring/workspaces/:workspaceId/drafts/:draftId", async (req: any, res: any) => res.status(200).json(createApiAssetAuthoringOperationSuccessResponse(API_ASSET_AUTHORING_READ_DRAFT_OPERATION, await d.assetDraftRepository?.readAssetDraftRecord(asString(req.params.workspaceId) as never, asString(req.params.draftId) as never))));
  d.app.get("/api/asset-authoring/workspaces/:workspaceId/authored-assets/:authoredAssetId/revisions", async (req: any, res: any) => res.status(200).json(createApiAssetAuthoringOperationSuccessResponse(API_ASSET_AUTHORING_LIST_REVISIONS_OPERATION, await d.assetRevisionRepository?.listAssetRevisionRecords({ workspaceId: asString(req.params.workspaceId) as never, authoredAssetId: asString(req.params.authoredAssetId) as never, limit: asLimit(req.query?.limit), cursor: asString(req.query?.cursor) || undefined }))));
  d.app.get("/api/asset-authoring/workspaces/:workspaceId/authored-assets/:authoredAssetId/revisions/:revisionId", async (req: any, res: any) => res.status(200).json(createApiAssetAuthoringOperationSuccessResponse(API_ASSET_AUTHORING_READ_REVISION_OPERATION, await d.assetRevisionRepository?.readAssetRevisionRecord(asString(req.params.workspaceId) as never, asString(req.params.authoredAssetId) as never, asString(req.params.revisionId) as never))));
  d.app.get("/api/asset-authoring/workspaces/:workspaceId/overrides", async (req: any, res: any) => res.status(200).json(createApiAssetAuthoringOperationSuccessResponse(API_ASSET_AUTHORING_LIST_OVERRIDES_OPERATION, await d.assetOverrideRepository?.listAssetOverrideRecords({ targetWorkspaceId: asString(req.params.workspaceId) as never, status: asString(req.query?.status) as never, conflictStatus: asString(req.query?.conflictStatus) as never, limit: asLimit(req.query?.limit), cursor: asString(req.query?.cursor) || undefined }))));
  d.app.get("/api/asset-authoring/workspaces/:workspaceId/overrides/:overrideId", async (req: any, res: any) => res.status(200).json(createApiAssetAuthoringOperationSuccessResponse(API_ASSET_AUTHORING_READ_OVERRIDE_OPERATION, await d.assetOverrideRepository?.readAssetOverrideRecord(asString(req.params.workspaceId) as never, asString(req.params.overrideId) as never))));
  d.app.get("/api/asset-authoring/workspaces/:workspaceId/effective-summaries", async (req: any, res: any) => {
    if (!d.effectiveSummaryReader) return fail(res, API_ASSET_AUTHORING_LIST_EFFECTIVE_SUMMARIES_OPERATION, "unavailable", 503, "Read unavailable.");
    return res.status(200).json(createApiAssetAuthoringOperationSuccessResponse(API_ASSET_AUTHORING_LIST_EFFECTIVE_SUMMARIES_OPERATION, { items: [] }));
  });
}
