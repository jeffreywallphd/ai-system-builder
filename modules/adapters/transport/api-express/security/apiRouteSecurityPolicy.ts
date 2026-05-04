export interface ApiRoutePolicy { public: boolean; scopes?: string[] }
const map = new Map<string, ApiRoutePolicy>([
  ["GET /api/security/status", { public: true }],
  ["POST /api/security/pairing/complete", { public: true }],
  ["POST /api/model/browse", { public: false, scopes: ["model:read"] }],
  ["POST /api/model/details", { public: false, scopes: ["model:read"] }],
  ["POST /api/model/list", { public: false, scopes: ["model:read"] }],
]);
export function resolveApiRoutePolicy(method: string, path: string): ApiRoutePolicy { return map.get(`${method.toUpperCase()} ${path}`) ?? { public: false }; }
