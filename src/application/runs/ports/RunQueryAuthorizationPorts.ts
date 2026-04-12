export interface AuthoritativeRunReadAuthorizationActor {
  readonly actorUserIdentityId: string;
  readonly activeWorkspaceId?: string;
  readonly authenticatedAt?: string;
}

export interface IAuthoritativeRunQueryAuthorizationPort {
  canReadWorkspaceRuns(input: {
    readonly workspaceId: string;
    readonly actor: AuthoritativeRunReadAuthorizationActor;
  }): Promise<boolean>;
  canReadRun(input: {
    readonly runId: string;
    readonly workspaceId?: string;
    readonly actor: AuthoritativeRunReadAuthorizationActor;
  }): Promise<boolean>;
}
