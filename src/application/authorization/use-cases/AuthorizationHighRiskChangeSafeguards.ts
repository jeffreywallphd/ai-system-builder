import { WorkspaceAuthorizationRoleKeys } from "../../../domain/authorization/AuthorizationRoleDefinitions";
import type { AuthorizationAdministrationOutcome } from "./AuthorizationAdministrationUseCaseShared";
import {
  AuthorizationAdministrationErrorCodes,
  toAuthorizationFailure,
} from "./AuthorizationAdministrationUseCaseShared";

export const AuthorizationHighRiskChangeCodes = Object.freeze({
  visibilityBroadened: "visibility-broadened",
  resourcePublished: "resource-published",
  resharingEnabled: "resharing-enabled",
  broadSubjectShare: "broad-subject-share",
  sharePermissionEscalation: "share-permission-escalation",
  lastWorkspaceAdministratorRemoval: "last-workspace-administrator-removal",
});

export type AuthorizationHighRiskChangeCode =
  typeof AuthorizationHighRiskChangeCodes[keyof typeof AuthorizationHighRiskChangeCodes];

const BroadWorkspaceRoleShareRiskRoleKeys = new Set<string>([
  WorkspaceAuthorizationRoleKeys.viewer,
  WorkspaceAuthorizationRoleKeys.member,
  WorkspaceAuthorizationRoleKeys.admin,
  WorkspaceAuthorizationRoleKeys.owner,
]);

const SharePermissionEscalationActions = new Set<string>([
  "create",
  "update",
  "delete",
  "share",
  "manage",
  "publish",
  "unpublish",
  "execute",
  "export",
  "mount",
  "unmount",
  "instantiate",
  "cancel",
  "retry",
]);

export function deriveVisibilityExposureRank(visibility: "private" | "shared" | "workspace" | "published"): number {
  switch (visibility) {
    case "private":
      return 0;
    case "shared":
      return 1;
    case "workspace":
      return 2;
    case "published":
      return 3;
    default:
      return 0;
  }
}

export function isBroadShareTarget(target: {
  readonly kind: "user" | "workspace-role" | "workspace" | "public";
  readonly roleKey?: string;
}): boolean {
  if (target.kind === "workspace" || target.kind === "public") {
    return true;
  }

  if (target.kind === "workspace-role") {
    return BroadWorkspaceRoleShareRiskRoleKeys.has(target.roleKey ?? "");
  }

  return false;
}

export function containsSharePermissionEscalation(permissionKeys: ReadonlyArray<string>): boolean {
  for (const permissionKey of permissionKeys) {
    const segments = permissionKey.split(".");
    const action = segments[segments.length - 1]?.trim().toLowerCase();
    if (action && SharePermissionEscalationActions.has(action)) {
      return true;
    }
  }

  return false;
}

export function deriveAddedPermissionKeys(
  previous: ReadonlyArray<string> | undefined,
  next: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const previousSet = new Set(previous ?? []);
  return Object.freeze([...new Set(next)].filter((permissionKey) => !previousSet.has(permissionKey)));
}

export function assertHighRiskChangesConfirmed<TValue>(input: {
  readonly actorUserIdentityId: string;
  readonly riskCodes: ReadonlyArray<AuthorizationHighRiskChangeCode>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}): AuthorizationAdministrationOutcome<TValue> | undefined {
  if (input.riskCodes.length === 0) {
    return undefined;
  }

  const confirmation = input.metadata?.authorizationHighRiskConfirmation;
  const confirmedRiskCodes = parseConfirmedRiskCodes(confirmation);
  const missingRiskCodes = input.riskCodes.filter((riskCode) => !confirmedRiskCodes.has(riskCode));
  if (missingRiskCodes.length === 0) {
    return undefined;
  }

  return toAuthorizationFailure(
    AuthorizationAdministrationErrorCodes.highRiskConfirmationRequired,
    "High-risk authorization change requires explicit server-side confirmation metadata.",
    Object.freeze({
      reasonCode: AuthorizationAdministrationErrorCodes.highRiskConfirmationRequired,
      actorUserIdentityId: input.actorUserIdentityId,
      riskCodes: Object.freeze([...new Set(input.riskCodes)]),
      missingRiskCodes: Object.freeze([...new Set(missingRiskCodes)]),
      confirmationMetadataPath: "metadata.authorizationHighRiskConfirmation.confirmedRiskCodes",
    }),
  );
}

function parseConfirmedRiskCodes(value: unknown): Set<string> {
  if (!value || typeof value !== "object") {
    return new Set();
  }

  const confirmedRiskCodes = (value as { confirmedRiskCodes?: unknown }).confirmedRiskCodes;
  if (!Array.isArray(confirmedRiskCodes)) {
    return new Set();
  }

  const normalized = confirmedRiskCodes
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return new Set(normalized);
}
