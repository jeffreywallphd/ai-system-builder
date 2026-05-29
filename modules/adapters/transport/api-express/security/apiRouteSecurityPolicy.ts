export interface ApiRoutePolicy { public: boolean; scopes?: string[]; deny?: boolean; securityCode?: string }

export const API_ROUTE_POLICIES: ReadonlyMap<string, ApiRoutePolicy> = new Map<string, ApiRoutePolicy>([
  ["GET /api/security/status", { public: true }],
  ["POST /api/security/pairing/complete", { public: true }],
  ["POST /api/security/token/revoke", { public: false, scopes: ["security:admin"] }],
  ["GET /api/security/tls/local-ca.pem", { public: true }],
  ["GET /api/security/dev-mode", { public: true }],
  ["POST /api/security/dev-mode", { public: true }],

  ["GET /api/workspaces", { public: false, scopes: ["workspace:read"] }],
  ["POST /api/workspaces", { public: false, scopes: ["workspace:write"] }],
  ["GET /api/workspaces/active-selection", { public: false, scopes: ["workspace:read"] }],
  ["POST /api/workspaces/active-selection", { public: false, scopes: ["workspace:write"] }],
  ["POST /api/workspaces/active-selection/clear", { public: false, scopes: ["workspace:write"] }],

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
  ["POST /api/image-generation/runtime-resources", { public: false, scopes: ["image-generation:read"] }],

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

  ["GET /api/assets/definitions", { public: false, scopes: ["asset:read"] }],
  ["GET /api/assets/definitions/:definitionId", { public: false, scopes: ["asset:read"] }],
  ["GET /api/assets/definitions/:definitionId/versions/:version", { public: false, scopes: ["asset:read"] }],
  ["GET /api/assets/resource-backed-views", { public: false, scopes: ["asset:read"] }],
  ["GET /api/assets/resource-backed-views/:viewId", { public: false, scopes: ["asset:read"] }],
  ["POST /api/assets/register-resource-backed-view", { public: false, scopes: ["asset:write"] }],
  ["POST /api/assets/finalize-generated-output", { public: false, scopes: ["asset:write"] }],
  ["POST /api/assets/import-external-repository-object", { public: false, scopes: ["asset:write"] }],
  ["POST /api/assets/localize-external-repository-object", { public: false, scopes: ["asset:write"] }],

  ["GET /api/asset-authoring/workspaces/:workspaceId/authored-assets", { public: false, scopes: ["asset:read"] }],
  ["GET /api/asset-authoring/workspaces/:workspaceId/authored-assets/:authoredAssetId", { public: false, scopes: ["asset:read"] }],
  ["POST /api/asset-authoring/workspaces/:workspaceId/authored-assets", { public: false, scopes: ["asset:write"] }],
  ["GET /api/asset-authoring/workspaces/:workspaceId/drafts", { public: false, scopes: ["asset:read"] }],
  ["GET /api/asset-authoring/workspaces/:workspaceId/drafts/:draftId", { public: false, scopes: ["asset:read"] }],
  ["POST /api/asset-authoring/workspaces/:workspaceId/drafts", { public: false, scopes: ["asset:write"] }],
  ["PATCH /api/asset-authoring/workspaces/:workspaceId/drafts/:draftId", { public: false, scopes: ["asset:write"] }],
  ["POST /api/asset-authoring/workspaces/:workspaceId/drafts/:draftId/publish", { public: false, scopes: ["asset:write"] }],
  ["GET /api/asset-authoring/workspaces/:workspaceId/revisions", { public: false, scopes: ["asset:read"] }],
  ["GET /api/asset-authoring/workspaces/:workspaceId/revisions/:revisionId", { public: false, scopes: ["asset:read"] }],
  ["GET /api/asset-authoring/workspaces/:workspaceId/overrides", { public: false, scopes: ["asset:read"] }],
  ["GET /api/asset-authoring/workspaces/:workspaceId/overrides/:overrideId", { public: false, scopes: ["asset:read"] }],
  ["POST /api/asset-authoring/workspaces/:workspaceId/overrides", { public: false, scopes: ["asset:write"] }],
  ["PATCH /api/asset-authoring/workspaces/:workspaceId/overrides/:overrideId", { public: false, scopes: ["asset:write"] }],
  ["POST /api/asset-authoring/workspaces/:workspaceId/overrides/:overrideId/disable", { public: false, scopes: ["asset:write"] }],
  ["GET /api/asset-authoring/workspaces/:workspaceId/effective-summaries", { public: false, scopes: ["asset:read"] }],
]);

export function resolveApiRoutePolicy(method: string, path: string): ApiRoutePolicy {
  const normalizedMethod = method.toUpperCase();
  const directPolicy = API_ROUTE_POLICIES.get(`${normalizedMethod} ${path}`);
  if (directPolicy) return directPolicy;

  for (const [route, policy] of API_ROUTE_POLICIES.entries()) {
    const [routeMethod, routePath] = splitRouteKey(route);
    if (routeMethod === normalizedMethod && routePath.includes(":") && routeTemplateMatchesPath(routePath, path)) {
      return policy;
    }
  }

  return path.startsWith('/api/') ? { public: false, deny: true, securityCode: 'security.route-policy-missing' } : { public: true };
}

function splitRouteKey(route: string): readonly [string, string] {
  const separatorIndex = route.indexOf(" ");
  return separatorIndex >= 0
    ? [route.slice(0, separatorIndex), route.slice(separatorIndex + 1)]
    : [route, ""];
}

function routeTemplateMatchesPath(template: string, path: string): boolean {
  const templateSegments = splitPath(template);
  const pathSegments = splitPath(path);
  if (templateSegments.length !== pathSegments.length) return false;
  return templateSegments.every((segment, index) => segment.startsWith(":") ? pathSegments[index].length > 0 : segment === pathSegments[index]);
}

function splitPath(path: string): readonly string[] {
  return path.split("/").filter((segment) => segment.length > 0);
}
