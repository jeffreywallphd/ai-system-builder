export interface IdentityAdministrativeAuthorizationContext {
  readonly assertions?: ReadonlyArray<string>;
  readonly scope?: string;
}

export interface IdentityAdministrativeAuditContext {
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IdentityAdministrativeActionContext {
  readonly actorUserIdentityId: string;
  readonly authorization?: IdentityAdministrativeAuthorizationContext;
  readonly audit?: IdentityAdministrativeAuditContext;
}
