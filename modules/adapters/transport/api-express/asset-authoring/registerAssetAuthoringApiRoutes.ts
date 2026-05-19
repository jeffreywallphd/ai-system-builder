import type { WorkspaceAssetAuthoringReadModelService } from "../../../../application/services/asset/workspace-asset-authoring-read-model.service";
import type { AuthoredAssetRepositoryPort, AssetDraftRepositoryPort, AssetOverrideRepositoryPort, AssetRevisionRepositoryPort } from "../../../../application/ports/asset-authoring";
import type { CreateWorkspaceAuthoredAssetUseCase, CreateAssetDraftUseCase, UpdateAssetDraftUseCase, PublishAssetDraftUseCase, CreateAssetOverrideUseCase, UpdateAssetOverrideUseCase, DisableAssetOverrideUseCase } from "../../../../application/use-cases/asset-authoring";
import { createApiAssetAuthoringFailureResponse, createApiAssetAuthoringOperationSuccessResponse, API_ASSET_AUTHORING_CREATE_WORKSPACE_AUTHORED_ASSET_OPERATION, API_ASSET_AUTHORING_CREATE_DRAFT_OPERATION, API_ASSET_AUTHORING_UPDATE_DRAFT_OPERATION, API_ASSET_AUTHORING_PUBLISH_DRAFT_OPERATION, API_ASSET_AUTHORING_CREATE_OVERRIDE_OPERATION, API_ASSET_AUTHORING_UPDATE_OVERRIDE_OPERATION, API_ASSET_AUTHORING_DISABLE_OVERRIDE_OPERATION, API_ASSET_AUTHORING_LIST_AUTHORED_ASSETS_OPERATION, API_ASSET_AUTHORING_READ_AUTHORED_ASSET_OPERATION, API_ASSET_AUTHORING_LIST_DRAFTS_OPERATION, API_ASSET_AUTHORING_READ_DRAFT_OPERATION, API_ASSET_AUTHORING_LIST_REVISIONS_OPERATION, API_ASSET_AUTHORING_READ_REVISION_OPERATION, API_ASSET_AUTHORING_LIST_OVERRIDES_OPERATION, API_ASSET_AUTHORING_READ_OVERRIDE_OPERATION, API_ASSET_AUTHORING_LIST_EFFECTIVE_SUMMARIES_OPERATION } from "../../../../contracts/api";
import type { AssetAuthoringFailureCode } from "../../../../contracts/asset-authoring";

interface App { get: (p: string, h: (req: Req, res: Res)=>Promise<void>|void) => void; post: (p: string, h: (req: Req, res: Res)=>Promise<void>|void) => void; patch: (p: string, h: (req: Req, res: Res)=>Promise<void>|void) => void; }
type Req={params?:Record<string,unknown>;query?:Record<string,unknown>;body?:Record<string,unknown>}; type Res={status:(code:number)=>Res;json:(payload:unknown)=>void};
const S=(v:unknown)=>typeof v==="string"?v.trim():"";
const toLimit=(v:unknown)=>{ const n=Number(v); return Number.isFinite(n)?Math.max(1,Math.min(100,Math.trunc(n))):25; };
const fail=(res: Res, op: string, code: AssetAuthoringFailureCode, status: number, message: string)=>res.status(status).json(createApiAssetAuthoringFailureResponse(op, code, message));
const mapStatus=(code:string)=>code==="validation"?400:code==="not-found"?404:code==="conflict"?409:code==="unsupported"?501:code==="unavailable"?503:500;
const required=(req:Req,key:string)=>{const v=S(req.params?.[key]); return v?{ok:true as const, v}:{ok:false as const};};
const bodyWorkspaceMatch=(req:Req,key:string,workspaceId:string)=>!req.body?.[key] || S(req.body[key])===workspaceId;
type AssetAuthoringCommandUseCase<TCommand, TResult> = { execute(command: TCommand): Promise<TResult> };

export interface RegisterAssetAuthoringApiRoutesDependencies { app: App; createWorkspaceAuthoredAssetUseCase?: CreateWorkspaceAuthoredAssetUseCase; createAssetDraftUseCase?: CreateAssetDraftUseCase; updateAssetDraftUseCase?: UpdateAssetDraftUseCase; publishAssetDraftUseCase?: PublishAssetDraftUseCase; createAssetOverrideUseCase?: CreateAssetOverrideUseCase; updateAssetOverrideUseCase?: UpdateAssetOverrideUseCase; disableAssetOverrideUseCase?: DisableAssetOverrideUseCase; authoredAssetRepository?: AuthoredAssetRepositoryPort; assetDraftRepository?: AssetDraftRepositoryPort; assetRevisionRepository?: AssetRevisionRepositoryPort; assetOverrideRepository?: AssetOverrideRepositoryPort; effectiveSummaryReader?: WorkspaceAssetAuthoringReadModelService; }
export function registerAssetAuthoringApiRoutes(d: RegisterAssetAuthoringApiRoutesDependencies): void {
  const cmd = <TCommand, TResult>(method: "post" | "patch", path: string, op: string, uc: AssetAuthoringCommandUseCase<TCommand, TResult>|undefined, workspaceField: string) => d.app[method](path, async (req, res) => {
    const w=required(req,"workspaceId"); if(!w.ok) return fail(res, op, "validation", 400, "workspaceId is required.");
    if (!bodyWorkspaceMatch(req, workspaceField, w.v)) return fail(res, op, "validation", 400, "workspace route/body mismatch.");
    if (!uc) return fail(res, op, "unavailable", 503, "Operation unavailable.");
    try { const r = await uc.execute({ ...(req.body ?? {}), [workspaceField]: w.v } as TCommand); if ((r as any).kind === "failure") return fail(res, op, (r as any).failure.code, mapStatus((r as any).failure.code), (r as any).failure.message); return res.status(200).json(createApiAssetAuthoringOperationSuccessResponse(op, (r as any).value)); }
    catch { return fail(res, op, "internal", 500, "Operation failed."); }
  });

  cmd("post", "/api/asset-authoring/workspaces/:workspaceId/authored-assets", API_ASSET_AUTHORING_CREATE_WORKSPACE_AUTHORED_ASSET_OPERATION, d.createWorkspaceAuthoredAssetUseCase, "workspaceId");
  cmd("post", "/api/asset-authoring/workspaces/:workspaceId/drafts", API_ASSET_AUTHORING_CREATE_DRAFT_OPERATION, d.createAssetDraftUseCase, "targetWorkspaceId");
  cmd("patch", "/api/asset-authoring/workspaces/:workspaceId/drafts/:draftId", API_ASSET_AUTHORING_UPDATE_DRAFT_OPERATION, d.updateAssetDraftUseCase, "targetWorkspaceId");
  cmd("post", "/api/asset-authoring/workspaces/:workspaceId/drafts/:draftId/publish", API_ASSET_AUTHORING_PUBLISH_DRAFT_OPERATION, d.publishAssetDraftUseCase, "targetWorkspaceId");
  cmd("post", "/api/asset-authoring/workspaces/:workspaceId/overrides", API_ASSET_AUTHORING_CREATE_OVERRIDE_OPERATION, d.createAssetOverrideUseCase, "targetWorkspaceId");
  cmd("patch", "/api/asset-authoring/workspaces/:workspaceId/overrides/:overrideId", API_ASSET_AUTHORING_UPDATE_OVERRIDE_OPERATION, d.updateAssetOverrideUseCase, "targetWorkspaceId");
  cmd("post", "/api/asset-authoring/workspaces/:workspaceId/overrides/:overrideId/disable", API_ASSET_AUTHORING_DISABLE_OVERRIDE_OPERATION, d.disableAssetOverrideUseCase, "targetWorkspaceId");

  d.app.get("/api/asset-authoring/workspaces/:workspaceId/authored-assets", async (req, res) => {
    if (!d.authoredAssetRepository) return fail(res, API_ASSET_AUTHORING_LIST_AUTHORED_ASSETS_OPERATION, "unavailable", 503, "Read unavailable."); const w=required(req,"workspaceId"); if(!w.ok) return fail(res, API_ASSET_AUTHORING_LIST_AUTHORED_ASSETS_OPERATION, "validation", 400, "workspaceId is required.");
    return res.status(200).json(createApiAssetAuthoringOperationSuccessResponse(API_ASSET_AUTHORING_LIST_AUTHORED_ASSETS_OPERATION, await d.authoredAssetRepository.listAuthoredAssetRecords({workspaceId:w.v as never,status:S(req.query?.status) as never,limit:toLimit(req.query?.limit),cursor:S(req.query?.cursor)||undefined})));
  });
  d.app.get("/api/asset-authoring/workspaces/:workspaceId/authored-assets/:authoredAssetId", async (req, res) => { if (!d.authoredAssetRepository) return fail(res, API_ASSET_AUTHORING_READ_AUTHORED_ASSET_OPERATION, "unavailable", 503, "Read unavailable."); const w=required(req,"workspaceId"); const id=required(req,"authoredAssetId"); if(!w.ok||!id.ok) return fail(res, API_ASSET_AUTHORING_READ_AUTHORED_ASSET_OPERATION, "validation", 400, "workspaceId and authoredAssetId are required."); return res.status(200).json(createApiAssetAuthoringOperationSuccessResponse(API_ASSET_AUTHORING_READ_AUTHORED_ASSET_OPERATION, await d.authoredAssetRepository.readAuthoredAssetRecordByWorkspace(w.v as never,id.v as never))); });
  d.app.get("/api/asset-authoring/workspaces/:workspaceId/effective-summaries", async (_req, res) => fail(res, API_ASSET_AUTHORING_LIST_EFFECTIVE_SUMMARIES_OPERATION, "unavailable", 503, "Workspace-wide effective summaries are deferred in Phase 8."));
}
