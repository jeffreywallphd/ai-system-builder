import type { ImageGenerationRequest } from "../../../../../../modules/contracts/image-generation";
import type { RuntimeTaskRecord } from "../../../../../../modules/contracts/runtime";

export interface ImageGenerationApiError { code: string; message: string; details?: Record<string, unknown>; endpoint: string; httpStatus?: number; requestId?: string; responseBody?: string; parsingFailure?: string; }
export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: ImageGenerationApiError };
function apiUrl(base: string, p: string) { return `${base.replace(/\/+$/,"") || "/api"}${p}`; }
async function parse<T>(response: Response, endpoint: string): Promise<ApiResult<T>> { const text = await response.text(); let body: any; try { body = text ? JSON.parse(text) : undefined; } catch { return { ok:false,error:{ code:"non-json-response", message:"Server returned a non-JSON response.", endpoint, httpStatus: response.status, responseBody: text.slice(0,500), parsingFailure:"json-parse-failed" } }; }
  if (!response.ok) return { ok:false,error:{ code: body?.error?.code ?? `http-${response.status}`, message: body?.error?.message ?? `Request failed (${response.status}).`, details: body?.error?.details, endpoint, httpStatus: response.status, requestId: body?.requestId, responseBody: typeof body === 'string'? body: undefined } };
  if (!body || typeof body !== 'object' || body.ok !== true) return { ok:false,error:{ code:"invalid-envelope", message:"Response is not a valid success envelope.", endpoint, httpStatus: response.status } };
  return { ok:true, value: body.value as T };
}
export function createApiImageGenerationClient(apiBaseUrl = "/api") { return {
  startImageGeneration: async (input: ImageGenerationRequest) => parse<{requestId:string}>(await fetch(apiUrl(apiBaseUrl,"/image-generation/start"),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({payload:input})}),"/image-generation/start"),
  readImageGeneration: async (requestId:string) => parse<RuntimeTaskRecord>(await fetch(apiUrl(apiBaseUrl,"/image-generation/read"),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({payload:{requestId}})}),"/image-generation/read"),
  finalizeImageGenerationIfCompleted: async (requestId:string) => parse<{assets?: Array<{assetId:string;artifactId:string;storageKey?:string}>}>(await fetch(apiUrl(apiBaseUrl,"/image-generation/finalize-if-completed"),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({payload:{requestId}})}),"/image-generation/finalize-if-completed"),
}; }
