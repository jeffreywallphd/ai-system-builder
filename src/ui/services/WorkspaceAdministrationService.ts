import { resolveDesktopIdentityApiBaseUrl } from "../desktop/identity/resolveDesktopIdentityApiBaseUrl";
import {
  HttpWorkspaceAdministrationClient,
  type WorkspaceAdministrationClient,
} from "@shared/workspaces/WorkspaceAdministrationClient";
import { resolveWebIdentityApiBaseUrl } from "../web/identity/resolveWebIdentityApiBaseUrl";

export class WorkspaceAdministrationService {
  private readonly client: WorkspaceAdministrationClient;

  public constructor(client: WorkspaceAdministrationClient = createDefaultWorkspaceAdministrationClient()) {
    this.client = client;
  }

  public listWorkspaces: WorkspaceAdministrationClient["listWorkspaces"] = (request, sessionToken) => (
    this.client.listWorkspaces(request, sessionToken)
  );

  public createWorkspace: WorkspaceAdministrationClient["createWorkspace"] = (request, sessionToken) => (
    this.client.createWorkspace(request, sessionToken)
  );

  public readWorkspaceAdministrationView: WorkspaceAdministrationClient["readWorkspaceAdministrationView"] = (
    request,
    sessionToken,
  ) => this.client.readWorkspaceAdministrationView(request, sessionToken);

  public updateWorkspace: WorkspaceAdministrationClient["updateWorkspace"] = (request, sessionToken) => (
    this.client.updateWorkspace(request, sessionToken)
  );

  public transitionWorkspaceLifecycle: WorkspaceAdministrationClient["transitionWorkspaceLifecycle"] = (
    request,
    sessionToken,
  ) => this.client.transitionWorkspaceLifecycle(request, sessionToken);

  public listWorkspaceMemberships: WorkspaceAdministrationClient["listWorkspaceMemberships"] = (request, sessionToken) => (
    this.client.listWorkspaceMemberships(request, sessionToken)
  );

  public addWorkspaceMember: WorkspaceAdministrationClient["addWorkspaceMember"] = (request, sessionToken) => (
    this.client.addWorkspaceMember(request, sessionToken)
  );

  public changeWorkspaceMembershipStatus: WorkspaceAdministrationClient["changeWorkspaceMembershipStatus"] = (
    request,
    sessionToken,
  ) => this.client.changeWorkspaceMembershipStatus(request, sessionToken);

  public removeWorkspaceMember: WorkspaceAdministrationClient["removeWorkspaceMember"] = (request, sessionToken) => (
    this.client.removeWorkspaceMember(request, sessionToken)
  );

  public listWorkspaceInvitations: WorkspaceAdministrationClient["listWorkspaceInvitations"] = (request, sessionToken) => (
    this.client.listWorkspaceInvitations(request, sessionToken)
  );

  public issueWorkspaceInvitation: WorkspaceAdministrationClient["issueWorkspaceInvitation"] = (
    request,
    sessionToken,
  ) => this.client.issueWorkspaceInvitation(request, sessionToken);

  public acceptWorkspaceInvitationOnboarding: WorkspaceAdministrationClient["acceptWorkspaceInvitationOnboarding"] = (
    request,
    sessionToken,
  ) => this.client.acceptWorkspaceInvitationOnboarding(request, sessionToken);

  public cancelWorkspaceInvitation: WorkspaceAdministrationClient["cancelWorkspaceInvitation"] = (
    request,
    sessionToken,
  ) => this.client.cancelWorkspaceInvitation(request, sessionToken);

  public listWorkspaceRoleAssignments: WorkspaceAdministrationClient["listWorkspaceRoleAssignments"] = (
    request,
    sessionToken,
  ) => this.client.listWorkspaceRoleAssignments(request, sessionToken);

  public assignWorkspaceRole: WorkspaceAdministrationClient["assignWorkspaceRole"] = (request, sessionToken) => (
    this.client.assignWorkspaceRole(request, sessionToken)
  );

  public reassignWorkspaceRole: WorkspaceAdministrationClient["reassignWorkspaceRole"] = (request, sessionToken) => (
    this.client.reassignWorkspaceRole(request, sessionToken)
  );

  public revokeWorkspaceRole: WorkspaceAdministrationClient["revokeWorkspaceRole"] = (request, sessionToken) => (
    this.client.revokeWorkspaceRole(request, sessionToken)
  );
}

function createDefaultWorkspaceAdministrationClient(): WorkspaceAdministrationClient {
  const desktopBaseUrl = resolveDesktopIdentityApiBaseUrl();
  const baseUrl = desktopBaseUrl ?? resolveWebIdentityApiBaseUrl();
  return new HttpWorkspaceAdministrationClient(baseUrl);
}

