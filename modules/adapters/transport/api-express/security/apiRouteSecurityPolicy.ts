export interface ApiRoutePolicy { public: boolean; scopes?: string[]; deny?: boolean }
const map = new Map<string, ApiRoutePolicy>([
  ["GET /api/security/status", { public: true }],
  ["POST /api/security/pairing/complete", { public: true }],
  ["POST /api/security/token/revoke", { public: false, scopes: ["security:admin"] }],
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
  ["POST /api/artifact/browse", { public: false, scopes: ["artifact:read"] }],
  ["POST /api/artifact/read", { public: false, scopes: ["artifact:read"] }],
  ["POST /api/artifact/content/read", { public: false, scopes: ["artifact:read"] }],
  ["GET /api/artifact/media/view", { public: false, scopes: ["artifact:read"] }],
  ["GET /api/artifact/upload/policy", { public: false, scopes: ["artifact:write"] }],
  ["POST /api/artifact/upload", { public: false, scopes: ["artifact:write"] }],
]);
export function resolveApiRoutePolicy(method: string, path: string): ApiRoutePolicy {
  return map.get(`${method.toUpperCase()} ${path}`) ?? (path.startsWith('/api/') ? { public: false, deny: true } : { public: true });
}
