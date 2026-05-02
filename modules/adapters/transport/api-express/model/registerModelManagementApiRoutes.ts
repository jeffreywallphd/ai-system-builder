import type { BrowseModelsUseCase, DeleteModelRecordUseCase, DownloadModelUseCase, GetModelDetailsUseCase, ListModelsUseCase, PublishModelUseCase, SaveModelReferenceUseCase, UpdateModelRecordUseCase, ValidateModelUseCase } from "../../../../application/use-cases/model";
import { createApiError, createApiFailureResponse, createApiSuccessResponse } from "../../../../contracts/api";
import {
  normalizeBrowseModelsRequest,
  normalizeDeleteModelRecordRequest,
  normalizeDownloadModelRequest,
  normalizeGetModelDetailsRequest,
  normalizeListModelsRequest,
  normalizeSaveModelReferenceRequest,
  normalizeUpdateModelRecordRequest,
  type BrowseModelsRequest,
  type DeleteModelRecordRequest,
  type DownloadModelRequest,
  type GetModelDetailsRequest,
  type ListModelsRequest,
  type SaveModelReferenceRequest,
  type UpdateModelRecordRequest,
} from "../../../../contracts/model";

interface ExpressRequestLike { body?: unknown; headers?: Record<string, string | string[] | undefined>; }
interface ExpressResponseLike { status: (code: number) => ExpressResponseLike; json: (body: unknown) => void; }
export interface ModelManagementExpressRoutePort { post: (path: string, handler: (request: ExpressRequestLike, response: ExpressResponseLike) => Promise<void>) => void; }
export interface RegisterModelManagementApiRoutesDependencies { app: ModelManagementExpressRoutePort; browseModelsUseCase: Pick<BrowseModelsUseCase, "execute">; getModelDetailsUseCase: Pick<GetModelDetailsUseCase, "execute">; listModelsUseCase: Pick<ListModelsUseCase, "execute">; saveModelReferenceUseCase: Pick<SaveModelReferenceUseCase, "execute">; downloadModelUseCase: Pick<DownloadModelUseCase, "execute">; updateModelRecordUseCase: Pick<UpdateModelRecordUseCase, "execute">; deleteModelRecordUseCase: Pick<DeleteModelRecordUseCase, "execute">; validateModelUseCase?: Pick<ValidateModelUseCase, "execute">; publishModelUseCase?: Pick<PublishModelUseCase, "execute">; }

class ModelManagementApiValidationError extends Error {}
const getHeader = (h: ExpressRequestLike["headers"], k: string) => Array.isArray(h?.[k]) ? h?.[k][0] : h?.[k];
const contextFrom = (r: ExpressRequestLike) => ({ requestId: getHeader(r.headers, "x-request-id"), correlationId: getHeader(r.headers, "x-correlation-id") });
const isObjectRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

function requireBodyObject(body: unknown): Record<string, unknown> {
  if (!isObjectRecord(body)) throw new ModelManagementApiValidationError("Request body must be an object.");
  return body;
}
function mapWithContractNormalizer<T>(body: unknown, normalize: (request: T) => T): T {
  try {
    return normalize(requireBodyObject(body) as T);
  } catch (error) {
    if (error instanceof ModelManagementApiValidationError) throw error;
    throw new ModelManagementApiValidationError(error instanceof Error ? error.message : "Invalid request body.");
  }
}
const mapBrowseModelsApiRequestToCommand = (body: unknown): BrowseModelsRequest => mapWithContractNormalizer(body, normalizeBrowseModelsRequest);
const mapGetModelDetailsApiRequestToCommand = (body: unknown): GetModelDetailsRequest => mapWithContractNormalizer(body, normalizeGetModelDetailsRequest);
const mapListModelsApiRequestToCommand = (body: unknown): ListModelsRequest => mapWithContractNormalizer(body, normalizeListModelsRequest);
const mapSaveModelReferenceApiRequestToCommand = (body: unknown): SaveModelReferenceRequest => mapWithContractNormalizer(body, normalizeSaveModelReferenceRequest);
const mapDownloadModelApiRequestToCommand = (body: unknown): DownloadModelRequest => mapWithContractNormalizer(body, normalizeDownloadModelRequest);
const mapUpdateModelRecordApiRequestToCommand = (body: unknown): UpdateModelRecordRequest => mapWithContractNormalizer(body, normalizeUpdateModelRecordRequest);
const mapDeleteModelRecordApiRequestToCommand = (body: unknown): DeleteModelRecordRequest => mapWithContractNormalizer(body, normalizeDeleteModelRecordRequest);

const mapFailureCode = (error: unknown): "internal" | "validation" | "not-found" | "unavailable" => {
  if (error instanceof ModelManagementApiValidationError) return "validation";
  if (typeof error === "object" && error && "code" in error) { const code = (error as { code?: string }).code; if (code === "validation" || code === "not-found" || code === "unavailable") return code; }
  return "internal";
};
const statusCode = (response: { ok: boolean; error?: { code: string } }) => response.ok ? 200 : response.error?.code === "validation" ? 400 : response.error?.code === "not-found" ? 404 : response.error?.code === "unavailable" ? 503 : 500;

function registerRoute(app: ModelManagementExpressRoutePort, path: string, operation: `${Lowercase<string>}.${Lowercase<string>}`, execute: (body: unknown) => Promise<unknown>) { app.post(path, async (request, response) => { const context = contextFrom(request); try { const value = await execute(request.body); const apiResponse = createApiSuccessResponse(operation, value, context); response.status(statusCode(apiResponse)).json(apiResponse); } catch (error) { const message = error instanceof Error ? error.message : "Unexpected error."; const apiResponse = createApiFailureResponse(createApiError(operation, mapFailureCode(error), message, context), context); response.status(statusCode(apiResponse)).json(apiResponse); } }); }

export function registerModelManagementApiRoutes(dependencies: RegisterModelManagementApiRoutesDependencies): void {
  registerRoute(dependencies.app, "/api/model/browse", "model.browse", async (body) => dependencies.browseModelsUseCase.execute(mapBrowseModelsApiRequestToCommand(body)));
  registerRoute(dependencies.app, "/api/model/details", "model.details", async (body) => dependencies.getModelDetailsUseCase.execute(mapGetModelDetailsApiRequestToCommand(body)));
  registerRoute(dependencies.app, "/api/model/list", "model.list", async (body) => dependencies.listModelsUseCase.execute(mapListModelsApiRequestToCommand(body)));
  registerRoute(dependencies.app, "/api/model/reference/save", "model.reference.save", async (body) => dependencies.saveModelReferenceUseCase.execute(mapSaveModelReferenceApiRequestToCommand(body)));
  registerRoute(dependencies.app, "/api/model/download", "model.download", async (body) => dependencies.downloadModelUseCase.execute(mapDownloadModelApiRequestToCommand(body)));
  registerRoute(dependencies.app, "/api/model/record/update", "model.record.update", async (body) => dependencies.updateModelRecordUseCase.execute(mapUpdateModelRecordApiRequestToCommand(body)));
  registerRoute(dependencies.app, "/api/model/record/delete", "model.record.delete", async (body) => dependencies.deleteModelRecordUseCase.execute(mapDeleteModelRecordApiRequestToCommand(body)));
}
