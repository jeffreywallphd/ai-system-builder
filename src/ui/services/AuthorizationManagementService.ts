import { resolveDesktopIdentityApiBaseUrl } from "../desktop/identity/resolveDesktopIdentityApiBaseUrl";
import {
  HttpAuthorizationManagementClient,
  type AuthorizationManagementClient,
} from "@shared/authorization/AuthorizationManagementClient";
import { resolveWebIdentityApiBaseUrl } from "../web/identity/resolveWebIdentityApiBaseUrl";

export class AuthorizationManagementService {
  private readonly client: AuthorizationManagementClient;

  public constructor(client: AuthorizationManagementClient = createDefaultAuthorizationManagementClient()) {
    this.client = client;
  }

  public readAccessState: AuthorizationManagementClient["readAccessState"] = (request, sessionToken) => (
    this.client.readAccessState(request, sessionToken)
  );

  public readWorkspaceSharingReport: AuthorizationManagementClient["readWorkspaceSharingReport"] = (request, sessionToken) => (
    this.client.readWorkspaceSharingReport(request, sessionToken)
  );

  public updateVisibility: AuthorizationManagementClient["updateVisibility"] = (request, sessionToken) => (
    this.client.updateVisibility(request, sessionToken)
  );

  public grantSharingAccess: AuthorizationManagementClient["grantSharingAccess"] = (request, sessionToken) => (
    this.client.grantSharingAccess(request, sessionToken)
  );

  public revokeSharingAccess: AuthorizationManagementClient["revokeSharingAccess"] = (request, sessionToken) => (
    this.client.revokeSharingAccess(request, sessionToken)
  );
}

function createDefaultAuthorizationManagementClient(): AuthorizationManagementClient {
  const desktopBaseUrl = resolveDesktopIdentityApiBaseUrl();
  const baseUrl = desktopBaseUrl ?? resolveWebIdentityApiBaseUrl();
  return new HttpAuthorizationManagementClient(baseUrl);
}

