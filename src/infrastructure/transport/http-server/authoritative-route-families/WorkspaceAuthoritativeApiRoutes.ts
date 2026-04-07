import {
  AuthoritativeApiRouteBackendKeys,
  AuthoritativeApiRouteDomains,
  type AuthoritativeApiRouteFamilyRegistration,
} from "../AuthoritativeApiRouteRegistration";

export const WorkspaceInvitationAuthoritativeApiRouteFamily = Object.freeze({
  routeFamilyId: "workspace-invitations",
  domain: AuthoritativeApiRouteDomains.workspaces,
  description: "Workspace invitation and onboarding endpoints exposed through authoritative APIs.",
  routePrefixes: Object.freeze([
    "/api/v1/workspaces/invitations",
    "/api/v1/workspaces/onboarding",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.workspaceInvitation,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;

export const WorkspaceAdministrationAuthoritativeApiRouteFamily = Object.freeze({
  routeFamilyId: "workspace-administration",
  domain: AuthoritativeApiRouteDomains.workspaces,
  description: "Workspace administration and membership management endpoints.",
  routePrefixes: Object.freeze([
    "/api/v1/workspaces",
  ]),
  requiredBackendKeys: Object.freeze([
    AuthoritativeApiRouteBackendKeys.workspaceAdministration,
  ]),
}) satisfies AuthoritativeApiRouteFamilyRegistration;

