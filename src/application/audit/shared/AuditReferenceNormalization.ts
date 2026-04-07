import type {
  AuditActorIdentity,
  AuditActorKind,
  AuditProtectedResourceReference,
  AuditScope,
  AuditScopeKind,
} from "@domain/audit/AuditDomain";
import {
  AuditActorKinds,
  AuditDomainError,
  AuditScopeKinds,
} from "@domain/audit/AuditDomain";

const WhitespacePattern = /\s+/g;
const PathSeparatorPattern = /[\\/]+/g;
const InvalidDelimiterPattern = /:+/g;
const InvalidBoundaryPattern = /^:+|:+$/g;

export interface AuthoritativeAuditActionContextInput {
  readonly sessionId?: string;
  readonly deviceId?: string;
  readonly nodeId?: string;
}

export interface NormalizedAuthoritativeAuditActionContext {
  readonly sessionRef?: string;
  readonly deviceRef?: string;
  readonly nodeRef?: string;
}

export interface NormalizedAuthoritativeAuditReferences {
  readonly actor: AuditActorIdentity;
  readonly scope: AuditScope;
  readonly protectedResource?: AuditProtectedResourceReference;
  readonly correlationId?: string;
  readonly requestId?: string;
  readonly actionContext?: NormalizedAuthoritativeAuditActionContext;
}

export interface NormalizeAuthoritativeAuditReferencesInput {
  readonly actor: AuditActorIdentity;
  readonly scope: AuditScope;
  readonly protectedResource?: AuditProtectedResourceReference;
  readonly correlationId?: string;
  readonly requestId?: string;
  readonly actionContext?: AuthoritativeAuditActionContextInput;
}

export const AuditReferenceContextPayloadKey = "referenceContext";

export function normalizeAuthoritativeAuditReferences(
  input: NormalizeAuthoritativeAuditReferencesInput,
): NormalizedAuthoritativeAuditReferences {
  const scope = normalizeAuditScopeReference(input.scope);
  const actor = normalizeAuditActorReference(input.actor);
  const protectedResource = normalizeAuditProtectedResourceReference(input.protectedResource, scope);
  const correlationId = normalizeOptionalCanonicalIdentifier(input.correlationId);
  const requestId = normalizeOptionalCanonicalIdentifier(input.requestId);
  const actionContext = normalizeAuditActionContextReference(input.actionContext, actor);

  return Object.freeze({
    actor,
    scope,
    protectedResource,
    correlationId,
    requestId,
    actionContext,
  });
}

export function normalizeAuditActorReference(actor: AuditActorIdentity): AuditActorIdentity {
  const actorKind = actor.actorKind;
  if (!isKnownActorKind(actorKind)) {
    throw new AuditDomainError(`Audit actor kind '${String(actorKind)}' is invalid.`);
  }

  const actorId = normalizeRequiredCanonicalIdentifier(actor.actorId, "actorId");

  const actorUserIdentityId = actorKind === AuditActorKinds.user
    ? normalizeOptionalCanonicalIdentifier(actor.actorUserIdentityId) ?? actorId
    : normalizeOptionalCanonicalIdentifier(actor.actorUserIdentityId);

  const actorServiceId = actorKind === AuditActorKinds.service
    ? normalizeOptionalCanonicalIdentifier(actor.actorServiceId) ?? actorId
    : normalizeOptionalCanonicalIdentifier(actor.actorServiceId);

  const actorSessionId = normalizeOptionalCanonicalIdentifier(actor.actorSessionId);

  return Object.freeze({
    actorId,
    actorKind,
    actorUserIdentityId,
    actorServiceId,
    actorSessionId,
  });
}

export function normalizeAuditScopeReference(scope: AuditScope): AuditScope {
  const kind = scope.kind;
  if (!isKnownScopeKind(kind)) {
    throw new AuditDomainError(`Audit scope kind '${String(kind)}' is invalid.`);
  }

  const workspaceId = normalizeOptionalCanonicalIdentifier(scope.workspaceId);

  if (kind === AuditScopeKinds.workspace && !workspaceId) {
    throw new AuditDomainError("Workspace audit scope requires workspaceId.");
  }

  if (kind === AuditScopeKinds.global && workspaceId) {
    throw new AuditDomainError("Global audit scope cannot include workspaceId.");
  }

  if (kind === AuditScopeKinds.global) {
    return Object.freeze({ kind });
  }

  return Object.freeze({
    kind,
    workspaceId,
  });
}

export function normalizeAuditProtectedResourceReference(
  protectedResource: AuditProtectedResourceReference | undefined,
  scope: AuditScope,
): AuditProtectedResourceReference | undefined {
  if (!protectedResource) {
    return undefined;
  }

  const resourceType = normalizeCanonicalResourceType(protectedResource.resourceType);
  const resourceId = normalizeRequiredCanonicalIdentifier(protectedResource.resourceId, "resourceId");

  const workspaceId = normalizeOptionalCanonicalIdentifier(protectedResource.workspaceId)
    ?? scope.workspaceId;

  const resourceRef = `${resourceType}:${resourceId}`;

  return Object.freeze({
    resourceType,
    resourceId,
    resourceRef,
    sensitivityClass: protectedResource.sensitivityClass,
    workspaceId,
  });
}

export function normalizeAuditActionContextReference(
  actionContext: AuthoritativeAuditActionContextInput | undefined,
  actor: AuditActorIdentity,
): NormalizedAuthoritativeAuditActionContext | undefined {
  const sessionId = normalizeOptionalCanonicalIdentifier(actionContext?.sessionId)
    ?? actor.actorSessionId;
  const deviceId = normalizeOptionalCanonicalIdentifier(actionContext?.deviceId);
  const nodeId = normalizeOptionalCanonicalIdentifier(actionContext?.nodeId);

  if (!sessionId && !deviceId && !nodeId) {
    return undefined;
  }

  return Object.freeze({
    sessionRef: sessionId ? toTypedReference("session", sessionId) : undefined,
    deviceRef: deviceId ? toTypedReference("device", deviceId) : undefined,
    nodeRef: nodeId ? toTypedReference("node", nodeId) : undefined,
  });
}

function normalizeCanonicalResourceType(value: string): string {
  return normalizeRequiredCanonicalIdentifier(value, "resourceType")
    .toLowerCase()
    .replace(/[^a-z0-9._:-]/g, "-");
}

function normalizeOptionalCanonicalIdentifier(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalized = trimmed
    .replace(WhitespacePattern, "-")
    .replace(PathSeparatorPattern, ":")
    .replace(InvalidDelimiterPattern, ":")
    .replace(InvalidBoundaryPattern, "");

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeRequiredCanonicalIdentifier(value: string, fieldName: string): string {
  const normalized = normalizeOptionalCanonicalIdentifier(value);
  if (!normalized) {
    throw new AuditDomainError(`${fieldName} is required.`);
  }
  return normalized;
}

function toTypedReference(prefix: "session" | "device" | "node", value: string): string {
  return value.startsWith(`${prefix}:`) ? value : `${prefix}:${value}`;
}

function isKnownActorKind(value: string): value is AuditActorKind {
  return Object.values(AuditActorKinds).includes(value as AuditActorKind);
}

function isKnownScopeKind(value: string): value is AuditScopeKind {
  return Object.values(AuditScopeKinds).includes(value as AuditScopeKind);
}
