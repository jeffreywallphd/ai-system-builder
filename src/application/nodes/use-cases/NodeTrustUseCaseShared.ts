import { NodeTrustDomainError } from "../../../domain/nodes/NodeTrustDomain";
import {
  NodeApprovalStatuses,
  NodeRevocationStates,
  NodeTrustStates,
} from "../../../domain/nodes/NodeTrustDomain";
import type { NodeIdentityPersistenceRecord } from "../../../shared/dto/nodes/NodeTrustPersistenceDtos";
import type { NodeTrustPersistenceMutationEnvelope } from "../../../shared/dto/nodes/NodeTrustPersistenceDtos";

export const NodeTrustUseCaseErrorCodes = Object.freeze({
  invalidRequest: "node-trust-invalid-request",
  forbidden: "node-trust-forbidden",
  notFound: "node-trust-not-found",
  conflict: "node-trust-conflict",
  invalidState: "node-trust-invalid-state",
});

export type NodeTrustUseCaseErrorCode =
  typeof NodeTrustUseCaseErrorCodes[keyof typeof NodeTrustUseCaseErrorCodes];

export interface NodeTrustUseCaseError {
  readonly code: NodeTrustUseCaseErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type NodeTrustUseCaseOutcome<TValue> =
  | {
    readonly ok: true;
    readonly value: TValue;
  }
  | {
    readonly ok: false;
    readonly error: NodeTrustUseCaseError;
  };

export interface NodeTrustUseCaseClock {
  now(): Date;
}

export interface NodeTrustUseCaseIdGenerator {
  nextId(namespace: string): string;
}

export const NodeTrustUseCaseIdNamespaces = Object.freeze({
  enrollmentRequest: "node-enrollment-request",
  mutationOperation: "node-trust-mutation",
});

export class DefaultNodeTrustUseCaseIdGenerator implements NodeTrustUseCaseIdGenerator {
  public nextId(namespace: string): string {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return `${namespace}:${globalThis.crypto.randomUUID()}`;
    }

    return `${namespace}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
  }
}

export function toNodeTrustFailure<TValue>(
  code: NodeTrustUseCaseErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): NodeTrustUseCaseOutcome<TValue> {
  return {
    ok: false,
    error: Object.freeze({
      code,
      message,
      details,
    }),
  };
}

export function normalizeRequired(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

export function createNodeTrustMutationEnvelope(input: {
  readonly actorUserIdentityId: string;
  readonly operationPrefix: string;
  readonly idGenerator: NodeTrustUseCaseIdGenerator;
  readonly clock: NodeTrustUseCaseClock;
  readonly expectedRevision?: number;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}): NodeTrustPersistenceMutationEnvelope {
  return Object.freeze({
    operationKey: `${input.operationPrefix}:${input.idGenerator.nextId(NodeTrustUseCaseIdNamespaces.mutationOperation)}`,
    expectedRevision: input.expectedRevision,
    context: Object.freeze({
      actorUserIdentityId: input.actorUserIdentityId,
      occurredAt: input.clock.now().toISOString(),
      reason: normalizeOptional(input.reason),
      correlationId: normalizeOptional(input.correlationId),
      metadata: input.metadata,
    }),
  });
}

export function mapNodeTrustDomainError<TValue>(
  error: unknown,
  fallbackMessage: string,
): NodeTrustUseCaseOutcome<TValue> | undefined {
  if (!(error instanceof NodeTrustDomainError)) {
    return undefined;
  }

  return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.invalidRequest, error.message || fallbackMessage);
}

export function enforceNodeAuthenticatedOperationTrust<TValue>(
  node: NodeIdentityPersistenceRecord,
  operationDescription: string,
): NodeTrustUseCaseOutcome<TValue> | undefined {
  const operation = operationDescription.trim() || "perform this operation";

  if (
    node.revocation.state === NodeRevocationStates.revoked
    || node.trustState === NodeTrustStates.revoked
    || Boolean(node.revokedAt)
    || Boolean(node.revocation.revokedAt)
  ) {
    return toNodeTrustFailure(
      NodeTrustUseCaseErrorCodes.invalidState,
      `Node '${node.nodeId}' is revoked and cannot ${operation}.`,
    );
  }

  if (node.approvalStatus !== NodeApprovalStatuses.approved) {
    const approvalMessage = node.approvalStatus === NodeApprovalStatuses.pending
      ? "is pending approval"
      : node.approvalStatus === NodeApprovalStatuses.rejected
        ? "has been rejected"
        : "is not approved";
    return toNodeTrustFailure(
      NodeTrustUseCaseErrorCodes.invalidState,
      `Node '${node.nodeId}' ${approvalMessage} and cannot ${operation}.`,
    );
  }

  if (node.trustState !== NodeTrustStates.trusted) {
    const trustMessage = node.trustState === NodeTrustStates.pendingEnrollment
      ? "is pending enrollment"
      : node.trustState === NodeTrustStates.pendingApproval
        ? "is pending activation"
        : node.trustState === NodeTrustStates.quarantined
          ? "is quarantined"
          : "is not trusted";
    return toNodeTrustFailure(
      NodeTrustUseCaseErrorCodes.invalidState,
      `Node '${node.nodeId}' ${trustMessage} and cannot ${operation}.`,
    );
  }

  if (!normalizeOptional(node.certificate?.certificateRef)) {
    return toNodeTrustFailure(
      NodeTrustUseCaseErrorCodes.invalidState,
      `Node '${node.nodeId}' is missing a certificate reference and cannot ${operation}.`,
    );
  }

  return undefined;
}
