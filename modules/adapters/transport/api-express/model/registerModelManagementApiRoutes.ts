import type { BrowseModelsUseCase, DeleteModelRecordUseCase, DownloadModelUseCase, GetModelDetailsUseCase, ListModelsUseCase, PublishModelUseCase, SaveModelReferenceUseCase, UpdateModelRecordUseCase, ValidateModelUseCase } from "../../../../application/use-cases/model";
import { createApiError, createApiFailureResponse, createApiSuccessResponse } from "../../../../contracts/api";
import { normalizeBrowseModelsRequest, normalizeDeleteModelRecordRequest, normalizeDownloadModelRequest, normalizeGetModelDetailsRequest, normalizeListModelsRequest, normalizeSaveModelReferenceRequest, normalizeUpdateModelRecordRequest, type PublishModelRequest, type ValidateModelRequest } from "../../../../contracts/model";

interface ExpressRequestLike { body?: unknown; headers?: Record<string, string | string[] | undefined>; }
interface ExpressResponseLike { status: (code: number) => ExpressResponseLike; json: (body: unknown) => void; }
export interface ModelManagementExpressRoutePort { post: (path: string, handler: (request: ExpressRequestLike, response: ExpressResponseLike) => Promise<void>) => void; }
export interface RegisterModelManagementApiRoutesDependencies { app: ModelManagementExpressRoutePort; browseModelsUseCase: Pick<BrowseModelsUseCase, "execute">; getModelDetailsUseCase: Pick<GetModelDetailsUseCase, "execute">; listModelsUseCase: Pick<ListModelsUseCase, "execute">; saveModelReferenceUseCase: Pick<SaveModelReferenceUseCase, "execute">; downloadModelUseCase: Pick<DownloadModelUseCase, "execute">; updateModelRecordUseCase: Pick<UpdateModelRecordUseCase, "execute">; deleteModelRecordUseCase: Pick<DeleteModelRecordUseCase, "execute">; validateModelUseCase?: Pick<ValidateModelUseCase, "execute">; publishModelUseCase?: Pick<PublishModelUseCase, "execute">; }

const getHeader = (h: ExpressRequestLike["headers"], k: string) => Array.isArray(h?.[k]) ? h?.[k][0] : h?.[k];
const contextFrom = (r: ExpressRequestLike) => ({ requestId: getHeader(r.headers, "x-request-id"), correlationId: getHeader(r.headers, "x-correlation-id") });
const isObjectRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const asObject = (body: unknown) => { if (!isObjectRecord(body)) throw new Error("Request body must be an object."); return body; };
const normalizeValidate = (body: unknown): ValidateModelRequest => { const p = asObject(body); const modelRecordId = typeof p.modelRecordId === "string" ? p.modelRecordId.trim() : ""; if (!modelRecordId) throw new Error("modelRecordId is required."); return { ...p, modelRecordId } as ValidateModelRequest; };
const normalizePublish = (body: unknown): PublishModelRequest => { const p = asObject(body); const modelRecordId = typeof p.modelRecordId === "string" ? p.modelRecordId.trim() : ""; const repository = typeof p.repository === "string" ? p.repository.trim() : ""; if (!modelRecordId) throw new Error("modelRecordId is required."); if (!repository) throw new Error("repository is required."); return { ...p, modelRecordId, repository } as PublishModelRequest; };
const mapFailureCode = (error: unknown): "internal" | "validation" | "not-found" | "unavailable" => {
  if (error instanceof Error && (error.message.includes("required") || error.message.includes("must") || error.message.includes("body"))) return "validation";
  if (typeof error === "object" && error && "code" in error) { const code = (error as { code?: string }).code; if (code === "validation" || code === "not-found" || code === "unavailable") return code; }
  return "internal";
};
const statusCode = (response: { ok: boolean; error?: { code: string } }) => response.ok ? 200 : response.error?.code === "validation" ? 400 : response.error?.code === "not-found" ? 404 : response.error?.code === "unavailable" ? 503 : 500;

function registerRoute(app: ModelManagementExpressRoutePort, path: string, operation: `${Lowercase<string>}.${Lowercase<string>}`, execute: (body: unknown) => Promise<unknown>) { app.post(path, async (request, response) => { const context = contextFrom(request); try { const value = await execute(request.body); const apiResponse = createApiSuccessResponse(operation, value, context); response.status(statusCode(apiResponse)).json(apiResponse); } catch (error) { const message = error instanceof Error ? error.message : "Unexpected error."; const apiResponse = createApiFailureResponse(createApiError(operation, mapFailureCode(error), message, context), context); response.status(statusCode(apiResponse)).json(apiResponse); } }); }

export function registerModelManagementApiRoutes(dependencies: RegisterModelManagementApiRoutesDependencies): void {
  registerRoute(dependencies.app, "/api/model/browse", "model.browse", async (body) => dependencies.browseModelsUseCase.execute(normalizeBrowseModelsRequest(asObject(body) as any)));
  registerRoute(dependencies.app, "/api/model/details", "model.details", async (body) => dependencies.getModelDetailsUseCase.execute(normalizeGetModelDetailsRequest(asObject(body) as any)));
  registerRoute(dependencies.app, "/api/model/list", "model.list", async (body) => dependencies.listModelsUseCase.execute(normalizeListModelsRequest(asObject(body) as any)));
  registerRoute(dependencies.app, "/api/model/reference/save", "model.reference.save", async (body) => dependencies.saveModelReferenceUseCase.execute(normalizeSaveModelReferenceRequest(asObject(body) as any)));
  registerRoute(dependencies.app, "/api/model/download", "model.download", async (body) => dependencies.downloadModelUseCase.execute(normalizeDownloadModelRequest(asObject(body) as any)));
  registerRoute(dependencies.app, "/api/model/record/update", "model.record.update", async (body) => dependencies.updateModelRecordUseCase.execute(normalizeUpdateModelRecordRequest(asObject(body) as any)));
  registerRoute(dependencies.app, "/api/model/record/delete", "model.record.delete", async (body) => dependencies.deleteModelRecordUseCase.execute(normalizeDeleteModelRecordRequest(asObject(body) as any)));
  if (dependencies.validateModelUseCase) registerRoute(dependencies.app, "/api/model/validate", "model.validate", async (body) => dependencies.validateModelUseCase!.execute(normalizeValidate(body)));
  if (dependencies.publishModelUseCase) registerRoute(dependencies.app, "/api/model/publish", "model.publish", async (body) => dependencies.publishModelUseCase!.execute(normalizePublish(body)));
}
