import {
  NodeApprovalStatuses,
  NodeEnrollmentRequestStatuses,
  NodeRevocationStates,
  NodeTrustStates,
  createNodeCapabilityProfile,
} from "@domain/nodes/NodeTrustDomain";
import type { NodeCapabilityProfilePersistenceRecord } from "@shared/dto/nodes/NodeTrustPersistenceDtos";
import type { INodeEnrollmentRequestPersistenceRepository } from "../ports/INodeEnrollmentRequestPersistenceRepository";
import type { INodeTrustIdentityPersistenceRepository } from "../ports/INodeTrustIdentityPersistenceRepository";
import type {
  ApprovedNodeCertificateEligibilityDecision,
  INodeCertificateEligibilityPort,
} from "../../security/ports/INodeCertificateEligibilityPort";

export interface ResolveApprovedNodeCertificateEligibilityUseCaseDependencies {
  readonly nodeRepository: INodeTrustIdentityPersistenceRepository;
  readonly enrollmentRequestRepository: INodeEnrollmentRequestPersistenceRepository;
}

export class ResolveApprovedNodeCertificateEligibilityUseCase implements INodeCertificateEligibilityPort {
  public constructor(private readonly dependencies: ResolveApprovedNodeCertificateEligibilityUseCaseDependencies) {}

  public async resolveApprovedNodeCertificateEligibility(input: {
    readonly nodeId: string;
  }): Promise<ApprovedNodeCertificateEligibilityDecision> {
    const nodeId = normalizeRequired(input.nodeId, "nodeId");
    const violations: string[] = [];

    const node = await this.dependencies.nodeRepository.findNodeById(nodeId);
    if (!node) {
      return Object.freeze({
        eligible: false,
        violations: Object.freeze([`Node '${nodeId}' does not exist and cannot receive an issued certificate.`]),
      });
    }

    if (node.approvalStatus !== NodeApprovalStatuses.approved) {
      violations.push(`Node '${node.nodeId}' must be approved before certificate issuance.`);
    }

    if (
      node.trustState !== NodeTrustStates.pendingApproval
      && node.trustState !== NodeTrustStates.trusted
    ) {
      violations.push(`Node '${node.nodeId}' must be in pending-approval or trusted state before certificate issuance.`);
    }

    if (
      node.trustState === NodeTrustStates.revoked
      || node.revocation.state === NodeRevocationStates.revoked
      || Boolean(node.revokedAt)
      || Boolean(node.revocation.revokedAt)
    ) {
      violations.push(`Node '${node.nodeId}' is revoked and cannot receive a certificate.`);
    }

    const enrollmentRequestId = normalizeOptional(node.enrollmentRequestId);
    if (!enrollmentRequestId) {
      violations.push(`Node '${node.nodeId}' is missing enrollment linkage and cannot receive a certificate.`);
      return Object.freeze({
        eligible: false,
        violations: Object.freeze(violations),
      });
    }

    const enrollment = await this.dependencies.enrollmentRequestRepository.findEnrollmentRequestById(enrollmentRequestId);
    if (!enrollment) {
      violations.push(`Node '${node.nodeId}' enrollment request '${enrollmentRequestId}' was not found.`);
      return Object.freeze({
        eligible: false,
        violations: Object.freeze(violations),
      });
    }

    if (enrollment.nodeId !== node.nodeId) {
      violations.push(
        `Enrollment request '${enrollment.requestId}' is linked to node '${enrollment.nodeId}', not '${node.nodeId}'.`,
      );
    }

    if (enrollment.status !== NodeEnrollmentRequestStatuses.approved) {
      violations.push(
        `Enrollment request '${enrollment.requestId}' must be approved before node certificate issuance.`,
      );
    }

    const normalizedNodeCapabilityProfile = normalizeCapabilityProfile(
      node.capabilityProfile,
      `Node '${node.nodeId}' capability profile is malformed.`,
      violations,
    );
    const normalizedEnrollmentCapabilityProfile = normalizeCapabilityProfile(
      enrollment.capabilityProfile,
      `Enrollment request '${enrollment.requestId}' capability profile is malformed.`,
      violations,
    );

    if (
      normalizedNodeCapabilityProfile
      && normalizedEnrollmentCapabilityProfile
      && !areCapabilityProfilesEqual(normalizedNodeCapabilityProfile, normalizedEnrollmentCapabilityProfile)
    ) {
      violations.push(
        `Node '${node.nodeId}' capability profile does not match approved enrollment request '${enrollment.requestId}'.`,
      );
    }

    if (violations.length > 0) {
      return Object.freeze({
        eligible: false,
        violations: Object.freeze(violations),
      });
    }

    return Object.freeze({
      eligible: true,
      metadata: Object.freeze({
        nodeId: node.nodeId,
        enrollmentRequestId: enrollment.requestId,
        capabilityProfile: normalizedNodeCapabilityProfile as NodeCapabilityProfilePersistenceRecord,
      }),
    });
  }
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeCapabilityProfile(
  profile: NodeCapabilityProfilePersistenceRecord,
  malformedMessage: string,
  violations: string[],
): NodeCapabilityProfilePersistenceRecord | undefined {
  try {
    const normalized = createNodeCapabilityProfile(profile);
    return Object.freeze({
      enabledCapabilities: Object.freeze([...normalized.enabledCapabilities]),
      capabilityProfileVersion: normalized.capabilityProfileVersion,
      supportsRemoteScheduling: normalized.supportsRemoteScheduling,
      maxConcurrentWorkloads: normalized.maxConcurrentWorkloads,
    });
  } catch {
    violations.push(malformedMessage);
    return undefined;
  }
}

function areCapabilityProfilesEqual(
  left: NodeCapabilityProfilePersistenceRecord,
  right: NodeCapabilityProfilePersistenceRecord,
): boolean {
  if (left.supportsRemoteScheduling !== right.supportsRemoteScheduling) {
    return false;
  }

  if ((left.capabilityProfileVersion ?? undefined) !== (right.capabilityProfileVersion ?? undefined)) {
    return false;
  }

  if ((left.maxConcurrentWorkloads ?? undefined) !== (right.maxConcurrentWorkloads ?? undefined)) {
    return false;
  }

  if (left.enabledCapabilities.length !== right.enabledCapabilities.length) {
    return false;
  }

  return left.enabledCapabilities.every((capability, index) => right.enabledCapabilities[index] === capability);
}

