import type { WorkspaceVisibility } from "@shared/workspaces/WorkspaceOwnership";
import {
  ImageWorkflowSystemAuthorizationResourceKinds,
  type ImageWorkflowSystemAuthorizationDecision,
  type ImageWorkflowSystemDefinitionPorts,
  type ImageWorkflowSystemPermissionAction,
} from "./ports";
import {
  ImageWorkflowSystemQueryError,
  ImageWorkflowSystemQueryErrorCodes,
} from "./ImageWorkflowSystemQueryErrors";

const DefaultListLimit = 25;
const MaxListLimit = 100;

export interface QueryBoundaryContext {
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly occurredAtIso: string;
}

export function createQueryBoundaryContext(input: {
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly occurredAt?: Date | string;
}): QueryBoundaryContext {
  const workspaceId = normalizeRequired(input.workspaceId, "workspaceId");
  const actorUserId = normalizeRequired(input.actorUserId, "actorUserId");
  const occurredAt = parseTimestamp(input.occurredAt, "occurredAt");
  return Object.freeze({
    workspaceId,
    actorUserId,
    occurredAtIso: occurredAt.toISOString(),
  });
}

export function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ImageWorkflowSystemQueryError(
      ImageWorkflowSystemQueryErrorCodes.invalidRequest,
      `${field} is required.`,
    );
  }
  return normalized;
}

export function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function normalizeStringArray(values?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  const normalized = [...new Set((values ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0))];
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

export function normalizeRevisionArray(values?: ReadonlyArray<number>): ReadonlyArray<number> | undefined {
  if (!values || values.length < 1) {
    return undefined;
  }
  const normalized = [...new Set(values)];
  for (const revision of normalized) {
    if (!Number.isInteger(revision) || revision < 0) {
      throw new ImageWorkflowSystemQueryError(
        ImageWorkflowSystemQueryErrorCodes.invalidRequest,
        "revisions must contain only non-negative integer values.",
      );
    }
  }
  return Object.freeze(normalized);
}

export function normalizeOffset(offset: number | undefined): number {
  if (typeof offset === "undefined") {
    return 0;
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ImageWorkflowSystemQueryError(
      ImageWorkflowSystemQueryErrorCodes.invalidRequest,
      "offset must be a non-negative integer when provided.",
    );
  }
  return offset;
}

export function normalizeLimit(limit: number | undefined): number {
  if (typeof limit === "undefined") {
    return DefaultListLimit;
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new ImageWorkflowSystemQueryError(
      ImageWorkflowSystemQueryErrorCodes.invalidRequest,
      "limit must be a positive integer when provided.",
    );
  }
  return Math.min(limit, MaxListLimit);
}

export function normalizeVisibilityArray(
  values?: ReadonlyArray<WorkspaceVisibility>,
): ReadonlyArray<WorkspaceVisibility> | undefined {
  const normalized = normalizeStringArray(values);
  if (!normalized) {
    return undefined;
  }
  return normalized as ReadonlyArray<WorkspaceVisibility>;
}

export async function authorizeWorkflowQueryAction(input: {
  readonly ports: ImageWorkflowSystemDefinitionPorts;
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly action: ImageWorkflowSystemPermissionAction;
  readonly resourceId?: string;
  readonly ownerUserId?: string;
  readonly visibility?: WorkspaceVisibility;
  readonly occurredAt?: string;
  readonly correlationId?: string;
}): Promise<ImageWorkflowSystemAuthorizationDecision> {
  const decision = await input.ports.authorization.authorizeImageWorkflowSystemAction({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: input.action,
    resource: {
      kind: ImageWorkflowSystemAuthorizationResourceKinds.workflowDefinition,
      resourceId: input.resourceId,
      ownerUserId: input.ownerUserId,
      visibility: input.visibility,
    },
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
  });

  if (!decision.allowed) {
    throw new ImageWorkflowSystemQueryError(
      ImageWorkflowSystemQueryErrorCodes.unauthorized,
      decision.reason?.trim() || "Actor is not authorized for image workflow definition query.",
      Object.freeze({
        action: input.action,
        reasonCode: decision.reasonCode,
        evaluatedAt: decision.evaluatedAt,
      }),
    );
  }

  return decision;
}

export async function authorizeSystemQueryAction(input: {
  readonly ports: ImageWorkflowSystemDefinitionPorts;
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly action: ImageWorkflowSystemPermissionAction;
  readonly resourceId?: string;
  readonly ownerUserId?: string;
  readonly visibility?: WorkspaceVisibility;
  readonly sharingPolicyId?: string;
  readonly occurredAt?: string;
  readonly correlationId?: string;
}): Promise<ImageWorkflowSystemAuthorizationDecision> {
  const decision = await input.ports.authorization.authorizeImageWorkflowSystemAction({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: input.action,
    resource: {
      kind: ImageWorkflowSystemAuthorizationResourceKinds.systemDefinition,
      resourceId: input.resourceId,
      ownerUserId: input.ownerUserId,
      visibility: input.visibility,
      sharingPolicyId: input.sharingPolicyId,
    },
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
  });

  if (!decision.allowed) {
    throw new ImageWorkflowSystemQueryError(
      ImageWorkflowSystemQueryErrorCodes.unauthorized,
      decision.reason?.trim() || "Actor is not authorized for image system definition query.",
      Object.freeze({
        action: input.action,
        reasonCode: decision.reasonCode,
        evaluatedAt: decision.evaluatedAt,
      }),
    );
  }

  return decision;
}

export function isHiddenByAuthorization(error: unknown): boolean {
  return error instanceof ImageWorkflowSystemQueryError
    && error.code === ImageWorkflowSystemQueryErrorCodes.unauthorized;
}

function parseTimestamp(value: Date | string | undefined, field: string): Date {
  if (!value) {
    return new Date();
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ImageWorkflowSystemQueryError(
      ImageWorkflowSystemQueryErrorCodes.invalidRequest,
      `${field} must be a valid timestamp when provided.`,
    );
  }
  return parsed;
}
