import type { IdentityAdministrativeActionContext } from "./IdentityAdministrativeContext";

export const TrustedDeviceAdministrativeActions = Object.freeze({
  listTrustedDevices: "list-trusted-devices",
  revokeTrustedDevice: "revoke-trusted-device",
});

export type TrustedDeviceAdministrativeAction =
  typeof TrustedDeviceAdministrativeActions[keyof typeof TrustedDeviceAdministrativeActions];

export interface TrustedDeviceAdministrativeAuthorizationRequest {
  readonly action: TrustedDeviceAdministrativeAction;
  readonly context: IdentityAdministrativeActionContext;
  readonly targetUserIdentityId: string;
  readonly targetWorkspaceId?: string;
}

export interface TrustedDeviceAdministrativeAuthorizationDecision {
  readonly allowed: boolean;
  readonly reasonCode?:
    | "missing-actor"
    | "missing-target-user"
    | "missing-admin-assertion";
  readonly message?: string;
  readonly policyId: string;
  readonly action: TrustedDeviceAdministrativeAction;
  readonly actorUserIdentityId?: string;
  readonly targetUserIdentityId?: string;
  readonly targetWorkspaceId?: string;
}

export interface TrustedDeviceAdministrativeAuthorizationPolicy {
  readonly policyId: string;
  evaluate(request: TrustedDeviceAdministrativeAuthorizationRequest): TrustedDeviceAdministrativeAuthorizationDecision;
}

const DEFAULT_ADMIN_ASSERTIONS = Object.freeze([
  "identity:trusted-devices:admin",
  "identity:accounts:manage",
]);

interface RoleAwareTrustedDeviceAdministrativeAuthorizationPolicyOptions {
  readonly adminAssertions?: ReadonlyArray<string>;
  readonly bootstrapAdminUserIdentityIds?: ReadonlyArray<string>;
}

export class RoleAwareTrustedDeviceAdministrativeAuthorizationPolicy
  implements TrustedDeviceAdministrativeAuthorizationPolicy {
  public readonly policyId = "role-aware-trusted-device-admin-v1";
  private readonly adminAssertions: ReadonlySet<string>;
  private readonly bootstrapAdminUserIdentityIds: ReadonlySet<string>;

  public constructor(options: RoleAwareTrustedDeviceAdministrativeAuthorizationPolicyOptions = {}) {
    this.adminAssertions = toNormalizedSet(options.adminAssertions ?? DEFAULT_ADMIN_ASSERTIONS);
    this.bootstrapAdminUserIdentityIds = toNormalizedSet(options.bootstrapAdminUserIdentityIds ?? []);
  }

  public evaluate(
    request: TrustedDeviceAdministrativeAuthorizationRequest,
  ): TrustedDeviceAdministrativeAuthorizationDecision {
    const actorUserIdentityId = normalizeOptional(request.context.actorUserIdentityId);
    const targetUserIdentityId = normalizeOptional(request.targetUserIdentityId);
    const targetWorkspaceId = normalizeOptional(request.targetWorkspaceId);
    if (!actorUserIdentityId) {
      return this.denied("missing-actor", "Administrative trusted-device action requires an actor identity.", request.action);
    }
    if (!targetUserIdentityId) {
      return this.denied(
        "missing-target-user",
        "Administrative trusted-device action requires a target user identity.",
        request.action,
        actorUserIdentityId,
      );
    }

    if (actorUserIdentityId === targetUserIdentityId) {
      return this.allowed(request.action, actorUserIdentityId, targetUserIdentityId, targetWorkspaceId);
    }

    if (this.bootstrapAdminUserIdentityIds.has(actorUserIdentityId.toLowerCase())) {
      return this.allowed(request.action, actorUserIdentityId, targetUserIdentityId, targetWorkspaceId);
    }

    const assertionSet = toNormalizedSet(request.context.authorization?.assertions ?? []);
    for (const assertion of this.adminAssertions) {
      if (assertionSet.has(assertion)) {
        return this.allowed(request.action, actorUserIdentityId, targetUserIdentityId, targetWorkspaceId);
      }
    }

    return this.denied(
      "missing-admin-assertion",
      `Trusted-device action '${request.action}' requires an administrative assertion or bootstrap admin identity.`,
      request.action,
      actorUserIdentityId,
      targetUserIdentityId,
      targetWorkspaceId,
    );
  }

  private allowed(
    action: TrustedDeviceAdministrativeAction,
    actorUserIdentityId: string,
    targetUserIdentityId: string,
    targetWorkspaceId?: string,
  ): TrustedDeviceAdministrativeAuthorizationDecision {
    return Object.freeze({
      allowed: true,
      policyId: this.policyId,
      action,
      actorUserIdentityId,
      targetUserIdentityId,
      targetWorkspaceId,
    });
  }

  private denied(
    reasonCode: NonNullable<TrustedDeviceAdministrativeAuthorizationDecision["reasonCode"]>,
    message: string,
    action: TrustedDeviceAdministrativeAction,
    actorUserIdentityId?: string,
    targetUserIdentityId?: string,
    targetWorkspaceId?: string,
  ): TrustedDeviceAdministrativeAuthorizationDecision {
    return Object.freeze({
      allowed: false,
      reasonCode,
      message,
      policyId: this.policyId,
      action,
      actorUserIdentityId,
      targetUserIdentityId,
      targetWorkspaceId,
    });
  }
}

function toNormalizedSet(values: ReadonlyArray<string>): ReadonlySet<string> {
  const set = new Set<string>();
  for (const value of values) {
    const normalized = normalizeOptional(value);
    if (normalized) {
      set.add(normalized.toLowerCase());
    }
  }
  return set;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
