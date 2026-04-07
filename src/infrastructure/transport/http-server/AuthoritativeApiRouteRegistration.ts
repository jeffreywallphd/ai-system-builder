export const AuthoritativeApiRouteDomains = Object.freeze({
  identity: "identity",
  workspaces: "workspaces",
  authorization: "authorization",
  nodes: "nodes",
  security: "security",
  storage: "storage",
  assets: "assets",
  runtime: "runtime",
});

export type AuthoritativeApiRouteDomain =
  typeof AuthoritativeApiRouteDomains[keyof typeof AuthoritativeApiRouteDomains];

export const AuthoritativeApiRouteBackendKeys = Object.freeze({
  identityAuth: "identity-auth",
  workspaceInvitation: "workspace-invitation",
  workspaceAdministration: "workspace-administration",
  authorizationManagement: "authorization-management",
  nodeTrust: "node-trust",
  certificateOperations: "certificate-operations",
  secretMetadata: "secret-metadata",
  storageManagement: "storage-management",
  assetManagement: "asset-management",
  systemRuntime: "system-runtime",
  runSubmission: "run-submission",
  runRead: "run-read",
  runExecutionUpdate: "run-execution-update",
});

export type AuthoritativeApiRouteBackendKey =
  typeof AuthoritativeApiRouteBackendKeys[keyof typeof AuthoritativeApiRouteBackendKeys];

export interface AuthoritativeApiRouteFamilyRegistration {
  readonly routeFamilyId: string;
  readonly domain: AuthoritativeApiRouteDomain;
  readonly description: string;
  readonly routePrefixes: ReadonlyArray<string>;
  readonly requiredBackendKeys: ReadonlyArray<AuthoritativeApiRouteBackendKey>;
}

export interface AuthoritativeApiRouteRegistrationPlan {
  readonly registeredRouteFamilies: ReadonlyArray<AuthoritativeApiRouteFamilyRegistration>;
  readonly registeredRoutePrefixes: ReadonlyArray<string>;
  readonly backendAvailability: Readonly<Record<AuthoritativeApiRouteBackendKey, boolean>>;
}

