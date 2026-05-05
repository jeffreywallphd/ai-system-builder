export interface ApiRoutePolicy { public: boolean; scopes?: string[]; deny?: boolean; securityCode?: string }

export const API_ROUTE_POLICIES: ReadonlyMap<string, ApiRoutePolicy> = new Map<string, ApiRoutePolicy>([
  ["GET /api/security/status", { public: true }],
  ["POST /api/security/pairing/complete", { public: true }],
  ["POST /api/security/token/revoke", { public: false, scopes: ["security:admin"] }],
  ["GET /api/security/tls/local-ca.pem", { public: true }],
  ["GET /api/security/dev-mode", { public: true }],
  ["POST /api/security/dev-mode", { public: true }],

  ["POST /api/model/browse", { public: false, scopes: ["model:read"] }],
  ["POST /api/model/details", { public: false, scopes: ["model:read"] }],
  ["POST /api/model/list", { public: false, scopes: ["model:read"] }],
  ["POST /api/model/reference/save", { public: false, scopes: ["model:write"] }],
  ["POST /api/model/download", { public: false, scopes: ["model:write"] }],
  ["POST /api/model/record/update", { public: false, scopes: ["model:write"] }],
  ["POST /api/model/record/delete", { public: false, scopes: ["model:write"] }],

  ["POST /api/image-generation/start", { public: false, scopes: ["image-generation:write"] }],
  ["POST /api/image-generation/read", { public: false, scopes: ["image-generation:read"] }],
  ["POST /api/image-generation/cancel", { public: false, scopes: ["image-generation:write"] }],
  ["POST /api/image-generation/finalize", { public: false, scopes: ["image-generation:write"] }],
  ["POST /api/image-generation/unload-model", { public: false, scopes: ["image-generation:write"] }],

  ["GET /api/config/huggingface-token", { public: false, scopes: ["artifact:read"] }],
  ["POST /api/config/huggingface-token", { public: false, scopes: ["artifact:write"] }],
  ["DELETE /api/config/huggingface-token", { public: false, scopes: ["artifact:write"] }],
  ["POST /api/application-settings/list-definitions", { public: false, scopes: ["artifact:read"] }],
  ["POST /api/application-settings/read", { public: false, scopes: ["artifact:read"] }],
  ["POST /api/application-settings/update", { public: false, scopes: ["artifact:write"] }],
  ["POST /api/application-settings/clear", { public: false, scopes: ["artifact:write"] }],
  ["POST /api/server/restart", { public: false, scopes: ["settings:write"] }],
  ["POST /api/artifact-repo/has", { public: false, scopes: ["artifact:read"] }],
  ["POST /api/huggingface/namespace/datasets", { public: false, scopes: ["artifact:read"] }],
  ["POST /api/huggingface/dataset/parquet-files", { public: false, scopes: ["artifact:read"] }],
  ["POST /api/artifact-repo/store", { public: false, scopes: ["artifact:write"] }],
  ["POST /api/artifact/publish", { public: false, scopes: ["artifact:write"] }],
  ["POST /api/artifact/publish/verify", { public: false, scopes: ["artifact:read"] }],
  ["POST /api/artifact/source/verify", { public: false, scopes: ["artifact:read"] }],
  ["POST /api/artifact/register-from-repo", { public: false, scopes: ["artifact:write"] }],
  ["POST /api/artifact/localize-from-repo", { public: false, scopes: ["artifact:write"] }],

  ["POST /api/artifact/browse", { public: false, scopes: ["artifact:read"] }],
  ["POST /api/artifact/read", { public: false, scopes: ["artifact:read"] }],
  ["POST /api/artifact/content/read", { public: false, scopes: ["artifact:read"] }],
  ["POST /api/artifact/delete", { public: false, scopes: ["artifact:write"] }],
  ["GET /api/artifact/media/view", { public: false, scopes: ["artifact:read"] }],
  ["GET /api/artifact/upload/policy", { public: false, scopes: ["artifact:write"] }],
  ["POST /api/artifact/upload", { public: false, scopes: ["artifact:write"] }],
]);

export function resolveApiRoutePolicy(method: string, path: string): ApiRoutePolicy {
  return API_ROUTE_POLICIES.get(`${method.toUpperCase()} ${path}`) ?? (path.startsWith('/api/') ? { public: false, deny: true, securityCode: 'security.route-policy-missing' } : { public: true });
}
