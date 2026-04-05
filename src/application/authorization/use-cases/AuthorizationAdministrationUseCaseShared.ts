import { AuthorizationPolicyEvaluationTargetKinds, type AuthorizationActorReference, type AuthorizationPolicyDecision } from "../contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationPolicyDecisionEvaluator } from "../ports/IAuthorizationPolicyDecisionEvaluator";
import { AuthorizationSchemaValidationError } from "../../../shared/schemas/authorization/AuthorizationSchemaContracts";
import type { AuthorizationPersistenceMutationEnvelope } from "../../../shared/dto/authorization/AuthorizationPersistenceDtos";

export const AuthorizationAdministrationErrorCodes = Object.freeze({
  invalidRequest: "authorization-administration-invalid-request",
  forbidden: "authorization-administration-forbidden",
  notFound: "authorization-administration-not-found",
  conflict: "authorization-administration-conflict",
  invalidState: "authorization-administration-invalid-state",
});

export type AuthorizationAdministrationErrorCode =
  typeof AuthorizationAdministrationErrorCodes[keyof typeof AuthorizationAdministrationErrorCodes];

export interface AuthorizationAdministrationError {
  readonly code: AuthorizationAdministrationErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type AuthorizationAdministrationOutcome<TValue> =
  | {
    readonly ok: true;
    readonly value: TValue;
  }
  | {
    readonly ok: false;
    readonly error: AuthorizationAdministrationError;
  };

export interface AuthorizationUseCaseClock {
  now(): Date;
}

export interface AuthorizationUseCaseIdGenerator {
  nextId(namespace: string): string;
}

export const AuthorizationUseCaseIdNamespaces = Object.freeze({
  roleAssignment: "authorization-role-assignment",
  sharingGrant: "authorization-sharing-grant",
  mutationOperation: "authorization-mutation-operation",
});

export class DefaultAuthorizationUseCaseIdGenerator implements AuthorizationUseCaseIdGenerator {
  public nextId(namespace: string): string {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return `${namespace}:${globalThis.crypto.randomUUID()}`;
    }

    return `${namespace}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
  }
}

export function toAuthorizationFailure<TValue>(
  code: AuthorizationAdministrationErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): AuthorizationAdministrationOutcome<TValue> {
  return {
    ok: false,
    error: Object.freeze({
      code,
      message,
      details,
    }),
  };
}

export function mapAuthorizationSchemaValidationError<TValue>(
  error: unknown,
): AuthorizationAdministrationOutcome<TValue> | undefined {
  if (!(error instanceof AuthorizationSchemaValidationError)) {
    return undefined;
  }

  return toAuthorizationFailure(
    AuthorizationAdministrationErrorCodes.invalidRequest,
    error.message,
    {
      schemaName: error.schemaName,
      issues: error.issues,
    },
  );
}

export function createAuthorizationMutationEnvelope(input: {
  readonly actorUserIdentityId: string;
  readonly operationPrefix: string;
  readonly idGenerator: AuthorizationUseCaseIdGenerator;
  readonly clock: AuthorizationUseCaseClock;
  readonly expectedRevision?: number;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}): AuthorizationPersistenceMutationEnvelope {
  return Object.freeze({
    operationKey: `${input.operationPrefix}:${input.idGenerator.nextId(AuthorizationUseCaseIdNamespaces.mutationOperation)}`,
    expectedRevision: input.expectedRevision,
    context: Object.freeze({
      actorUserIdentityId: input.actorUserIdentityId,
      occurredAt: input.clock.now().toISOString(),
      reason: normalizeOptionalString(input.reason),
      correlationId: normalizeOptionalString(input.correlationId),
      metadata: input.metadata,
    }),
  });
}

export async function assertActorAuthorizedForWorkspaceCapability(input: {
  readonly decisionEvaluator: IAuthorizationPolicyDecisionEvaluator;
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly requiredPermissionKey: string;
  readonly asOf?: string;
}): Promise<AuthorizationPolicyDecision> {
  const decision = await input.decisionEvaluator.evaluateDecision({
    actor: {
      actorUserIdentityId: input.actorUserIdentityId,
      activeWorkspaceId: input.workspaceId,
    },
    requiredPermissionKey: input.requiredPermissionKey,
    target: {
      kind: AuthorizationPolicyEvaluationTargetKinds.workspaceCapability,
      workspaceId: input.workspaceId,
      capabilityResourceType: "authorization-administration",
    },
    asOf: input.asOf,
  });

  return decision.decision;
}

export async function assertActorAuthorizedForResourcePermission(input: {
  readonly decisionEvaluator: IAuthorizationPolicyDecisionEvaluator;
  readonly actor: AuthorizationActorReference;
  readonly resource: {
    readonly resourceFamily: string;
    readonly resourceType: string;
    readonly resourceId: string;
  };
  readonly requiredPermissionKey: string;
  readonly asOf?: string;
}): Promise<AuthorizationPolicyDecision> {
  const decision = await input.decisionEvaluator.evaluateDecision({
    actor: input.actor,
    requiredPermissionKey: input.requiredPermissionKey,
    target: {
      kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
      resource: {
        resourceFamily: input.resource.resourceFamily,
        resourceType: input.resource.resourceType,
        resourceId: input.resource.resourceId,
      },
    },
    asOf: input.asOf,
  });

  return decision.decision;
}

export function normalizeOptionalString(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
