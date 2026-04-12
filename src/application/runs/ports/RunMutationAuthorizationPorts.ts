export interface AuthoritativeRunMutationAuthorizationActor {
  readonly actorUserIdentityId: string;
  readonly activeWorkspaceId?: string;
  readonly authenticatedAt?: string;
}

export interface IAuthoritativeRunMutationAuthorizationPort {
  canCancelRun(input: {
    readonly runId: string;
    readonly workspaceId?: string;
    readonly actor: AuthoritativeRunMutationAuthorizationActor;
  }): Promise<boolean>;
}
