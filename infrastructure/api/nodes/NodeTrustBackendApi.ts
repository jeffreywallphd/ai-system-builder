import type {
  ApproveNodeEnrollmentUseCase,
  GetNodeInventoryDetailUseCase,
  GetNodeEnrollmentDetailUseCase,
  ListNodeInventoryUseCase,
  ListTrustedNodeInventoryUseCase,
  RecordNodeHeartbeatUseCase,
  RegisterNodeEnrollmentRequestUseCase,
  RejectNodeEnrollmentUseCase,
  ReviewPendingNodeEnrollmentUseCase,
} from "../../src/application/nodes/use-cases";
import type {
  NodeInventoryDetailReadModel,
  NodeInventorySummaryReadModel,
} from "../../src/application/nodes/use-cases/NodeInventoryReadModels";
import { NodeTrustUseCaseErrorCodes } from "../../src/application/nodes/use-cases/NodeTrustUseCaseShared";
import {
  toNodeInventoryDetailDto,
  toNodeInventorySummaryDto,
  toNodeDetailDto,
  toNodeEnrollmentDetailDto,
  toNodePendingEnrollmentSummaryDto,
  type NodeInternalInventoryDetailDto,
  type NodeInternalInventorySummaryDto,
  type NodeInternalDetailDto,
  type NodeInternalEnrollmentDetailDto,
} from "../../src/shared/contracts/nodes/NodeTrustApiContracts";
import type {
  NodeEnrollmentRequestPersistenceRecord,
  NodeIdentityPersistenceRecord,
} from "../../src/shared/dto/nodes/NodeTrustPersistenceDtos";
import {
  type ApproveNodeEnrollmentApiRequest,
  type ApproveNodeEnrollmentApiResponse,
  type GetNodeEnrollmentDetailApiRequest,
  type GetNodeEnrollmentDetailApiResponse,
  type GetNodeInventoryDetailApiRequest,
  type GetNodeInventoryDetailApiResponse,
  type ListNodeInventoryApiRequest,
  type ListNodeInventoryApiResponse,
  type ListTrustedNodeInventoryApiRequest,
  type ListTrustedNodeInventoryApiResponse,
  NodeTrustApiErrorCodes,
  type RecordNodeHeartbeatApiRequest,
  type RecordNodeHeartbeatApiResponse,
  type ListPendingNodeEnrollmentsApiRequest,
  type ListPendingNodeEnrollmentsApiResponse,
  type NodeTrustApiError,
  type NodeTrustApiResponse,
  type RejectNodeEnrollmentApiRequest,
  type RejectNodeEnrollmentApiResponse,
  type SubmitNodeEnrollmentApiRequest,
  type SubmitNodeEnrollmentApiResponse,
} from "./sdk/PublicNodeTrustApiContract";

interface NodeTrustBackendApiDependencies {
  readonly registerNodeEnrollmentRequestUseCase: RegisterNodeEnrollmentRequestUseCase;
  readonly reviewPendingNodeEnrollmentUseCase: ReviewPendingNodeEnrollmentUseCase;
  readonly getNodeEnrollmentDetailUseCase: GetNodeEnrollmentDetailUseCase;
  readonly getNodeInventoryDetailUseCase: GetNodeInventoryDetailUseCase;
  readonly approveNodeEnrollmentUseCase: ApproveNodeEnrollmentUseCase;
  readonly rejectNodeEnrollmentUseCase: RejectNodeEnrollmentUseCase;
  readonly recordNodeHeartbeatUseCase: RecordNodeHeartbeatUseCase;
  readonly listTrustedNodeInventoryUseCase: ListTrustedNodeInventoryUseCase;
  readonly listNodeInventoryUseCase: ListNodeInventoryUseCase;
}

export class NodeTrustBackendApi {
  public constructor(private readonly dependencies: NodeTrustBackendApiDependencies) {}

  public async submitNodeEnrollment(
    request: SubmitNodeEnrollmentApiRequest,
  ): Promise<NodeTrustApiResponse<SubmitNodeEnrollmentApiResponse>> {
    const bootstrapTrustMaterialRef = request.bootstrap?.trustMaterialRef?.trim();
    const certificateRef = request.certificateRef?.trim() || bootstrapTrustMaterialRef;

    const bootstrapPublicMaterial = request.bootstrap
      ? Object.freeze({
        trustMaterialRef: request.bootstrap.trustMaterialRef,
        publicKeyAlgorithm: request.bootstrap.publicKeyAlgorithm,
        publicKeyFingerprintSha256: request.bootstrap.publicKeyFingerprintSha256,
        attestationFormat: request.bootstrap.attestationFormat,
        requestedCertificateProfile: request.bootstrap.requestedCertificateProfile,
      })
      : undefined;

    const metadata = bootstrapPublicMaterial
      ? Object.freeze({
        ...request.metadata,
        bootstrapPublicMaterial,
      })
      : request.metadata;

    const outcome = await this.dependencies.registerNodeEnrollmentRequestUseCase.execute({
      actorUserIdentityId: request.actorUserIdentityId,
      nodeId: request.nodeId,
      nodeType: request.nodeType,
      displayName: request.displayName,
      capabilityProfile: request.capabilityProfile,
      deploymentTags: request.deploymentTags,
      certificateRef,
      requestedAt: request.requestedAt,
      correlationId: request.correlationId,
      metadata,
    });

    if (!outcome.ok) {
      return Object.freeze({
        ok: false,
        error: this.mapUseCaseError(outcome.error.code, outcome.error.message),
      });
    }

    const enrollment = toNodeEnrollmentDetailDto(this.toInternalEnrollment(outcome.value.enrollmentRequest));

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        enrollment,
      }),
    });
  }

  public async listPendingNodeEnrollments(
    request: ListPendingNodeEnrollmentsApiRequest,
  ): Promise<NodeTrustApiResponse<ListPendingNodeEnrollmentsApiResponse>> {
    const outcome = await this.dependencies.reviewPendingNodeEnrollmentUseCase.execute({
      actorUserIdentityId: request.actorUserIdentityId,
      nodeId: request.nodeId,
      statuses: request.statuses,
      limit: request.limit,
      offset: request.offset,
    });

    if (!outcome.ok) {
      return Object.freeze({
        ok: false,
        error: this.mapUseCaseError(outcome.error.code, outcome.error.message),
      });
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        enrollments: Object.freeze(outcome.value.enrollments.map((enrollment) => (
          toNodePendingEnrollmentSummaryDto(this.toInternalEnrollment(enrollment))
        ))),
      }),
    });
  }

  public async getNodeEnrollmentDetail(
    request: GetNodeEnrollmentDetailApiRequest,
  ): Promise<NodeTrustApiResponse<GetNodeEnrollmentDetailApiResponse>> {
    const outcome = await this.dependencies.getNodeEnrollmentDetailUseCase.execute({
      actorUserIdentityId: request.actorUserIdentityId,
      requestId: request.requestId,
    });

    if (!outcome.ok) {
      return Object.freeze({
        ok: false,
        error: this.mapUseCaseError(outcome.error.code, outcome.error.message),
      });
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        enrollment: toNodeEnrollmentDetailDto(this.toInternalEnrollment(outcome.value.enrollmentRequest)),
      }),
    });
  }

  public async approveNodeEnrollment(
    request: ApproveNodeEnrollmentApiRequest,
  ): Promise<NodeTrustApiResponse<ApproveNodeEnrollmentApiResponse>> {
    const outcome = await this.dependencies.approveNodeEnrollmentUseCase.execute({
      actorUserIdentityId: request.actorUserIdentityId,
      requestId: request.requestId,
      reviewedAt: request.reviewedAt,
      decisionNote: request.decisionNote,
      certificateRef: request.certificate?.certificateRef,
      certificateAuthorityRef: request.certificate?.certificateAuthorityRef,
      certificateThumbprint: request.certificate?.certificateThumbprint,
      certificateExpiresAt: request.certificate?.certificateExpiresAt,
      correlationId: request.correlationId,
      metadata: request.metadata,
    });

    if (!outcome.ok) {
      return Object.freeze({
        ok: false,
        error: this.mapUseCaseError(outcome.error.code, outcome.error.message),
      });
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        enrollment: toNodeEnrollmentDetailDto(this.toInternalEnrollment(outcome.value.enrollmentRequest)),
        node: toNodeDetailDto(this.toInternalNode(outcome.value.node)),
      }),
    });
  }

  public async rejectNodeEnrollment(
    request: RejectNodeEnrollmentApiRequest,
  ): Promise<NodeTrustApiResponse<RejectNodeEnrollmentApiResponse>> {
    const outcome = await this.dependencies.rejectNodeEnrollmentUseCase.execute({
      actorUserIdentityId: request.actorUserIdentityId,
      requestId: request.requestId,
      reviewedAt: request.reviewedAt,
      decisionNote: request.decisionNote,
      correlationId: request.correlationId,
      metadata: request.metadata,
    });

    if (!outcome.ok) {
      return Object.freeze({
        ok: false,
        error: this.mapUseCaseError(outcome.error.code, outcome.error.message),
      });
    }
    if (!outcome.value.node) {
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: NodeTrustApiErrorCodes.internal,
          message: "Enrollment rejection completed without a node lifecycle record.",
        }),
      });
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        enrollment: toNodeEnrollmentDetailDto(this.toInternalEnrollment(outcome.value.enrollmentRequest)),
        node: toNodeDetailDto(this.toInternalNode(outcome.value.node)),
      }),
    });
  }

  public async recordNodeHeartbeat(
    request: RecordNodeHeartbeatApiRequest,
  ): Promise<NodeTrustApiResponse<RecordNodeHeartbeatApiResponse>> {
    const outcome = await this.dependencies.recordNodeHeartbeatUseCase.execute({
      actorUserIdentityId: request.actorUserIdentityId,
      nodeId: request.nodeId,
      heartbeatStatus: request.heartbeatStatus,
      seenAt: request.seenAt,
      observedBy: request.observedBy,
      metadata: request.metadata,
    });

    if (!outcome.ok) {
      return Object.freeze({
        ok: false,
        error: this.mapUseCaseError(outcome.error.code, outcome.error.message),
      });
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        node: toNodeDetailDto(this.toInternalNode(outcome.value.node)),
      }),
    });
  }

  public async listTrustedNodeInventory(
    request: ListTrustedNodeInventoryApiRequest,
  ): Promise<NodeTrustApiResponse<ListTrustedNodeInventoryApiResponse>> {
    const outcome = await this.dependencies.listTrustedNodeInventoryUseCase.execute({
      actorUserIdentityId: request.actorUserIdentityId,
      nodeTypes: request.nodeTypes,
      capabilityAnyOf: request.capabilityAnyOf,
      deploymentTagAnyOf: request.deploymentTagAnyOf,
      lastSeenAfter: request.lastSeenAfter,
      lastSeenBefore: request.lastSeenBefore,
      limit: request.limit,
      offset: request.offset,
    });

    if (!outcome.ok) {
      return Object.freeze({
        ok: false,
        error: this.mapUseCaseError(outcome.error.code, outcome.error.message),
      });
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        nodes: Object.freeze(outcome.value.nodes.map((node) => toNodeDetailDto(this.toInternalNode(node)))),
      }),
    });
  }

  public async listNodeInventory(
    request: ListNodeInventoryApiRequest,
  ): Promise<NodeTrustApiResponse<ListNodeInventoryApiResponse>> {
    const outcome = await this.dependencies.listNodeInventoryUseCase.execute({
      actorUserIdentityId: request.actorUserIdentityId,
      nodeTypes: request.nodeTypes,
      approvalStatuses: request.approvalStatuses,
      presenceStates: request.presenceStates,
      operationalStates: request.operationalStates,
      capabilityAnyOf: request.capabilityAnyOf,
      deploymentTagAnyOf: request.deploymentTagAnyOf,
      lastSeenAfter: request.lastSeenAfter,
      lastSeenBefore: request.lastSeenBefore,
      limit: request.limit,
      offset: request.offset,
    });

    if (!outcome.ok) {
      return Object.freeze({
        ok: false,
        error: this.mapUseCaseError(outcome.error.code, outcome.error.message),
      });
    }

    const enrollmentStatuses = request.enrollmentStatuses;
    const nodes = enrollmentStatuses && enrollmentStatuses.length > 0
      ? outcome.value.nodes.filter((node) => {
        if (!node.enrollmentStatus) {
          return false;
        }
        return enrollmentStatuses.includes(node.enrollmentStatus);
      })
      : outcome.value.nodes;

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        nodes: Object.freeze(nodes.map((node) => toNodeInventorySummaryDto(this.toInternalInventorySummary(node)))),
      }),
    });
  }

  public async getNodeInventoryDetail(
    request: GetNodeInventoryDetailApiRequest,
  ): Promise<NodeTrustApiResponse<GetNodeInventoryDetailApiResponse>> {
    const outcome = await this.dependencies.getNodeInventoryDetailUseCase.execute({
      actorUserIdentityId: request.actorUserIdentityId,
      nodeId: request.nodeId,
    });

    if (!outcome.ok) {
      return Object.freeze({
        ok: false,
        error: this.mapUseCaseError(outcome.error.code, outcome.error.message),
      });
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        node: toNodeInventoryDetailDto(this.toInternalInventoryDetail(outcome.value.node)),
      }),
    });
  }

  private toInternalEnrollment(input: NodeEnrollmentRequestPersistenceRecord): NodeInternalEnrollmentDetailDto {
    return Object.freeze({
      requestId: input.requestId,
      nodeId: input.nodeId,
      nodeType: input.nodeType,
      displayName: input.displayName,
      status: input.status,
      requestedAt: input.requestedAt,
      reviewedAt: input.reviewedAt,
      reviewedByUserIdentityId: input.reviewedByUserIdentityId,
      decisionNote: input.decisionNote,
      capabilityProfile: input.capabilityProfile,
      deploymentTags: input.deploymentTags,
      certificateRef: input.certificateRef,
      createdAt: input.createdAt,
      createdBy: input.createdBy,
      lastModifiedAt: input.lastModifiedAt,
      lastModifiedBy: input.lastModifiedBy,
      revision: input.revision,
    });
  }

  private toInternalNode(input: NodeIdentityPersistenceRecord): NodeInternalDetailDto {
    return Object.freeze({
      nodeId: input.nodeId,
      nodeType: input.nodeType,
      displayName: input.displayName,
      approvalStatus: input.approvalStatus,
      trustState: input.trustState,
      capabilityProfile: input.capabilityProfile,
      deploymentTags: input.deploymentTags,
      certificate: input.certificate,
      lastSeen: input.lastSeen,
      revocation: input.revocation,
      enrolledAt: input.enrolledAt,
      approvedAt: input.approvedAt,
      revokedAt: input.revokedAt,
      enrollmentRequestId: input.enrollmentRequestId,
      createdAt: input.createdAt,
      createdBy: input.createdBy,
      lastModifiedAt: input.lastModifiedAt,
      lastModifiedBy: input.lastModifiedBy,
      revision: input.revision,
    });
  }

  private toInternalInventorySummary(
    input: NodeInventorySummaryReadModel,
  ): NodeInternalInventorySummaryDto {
    return Object.freeze({
      nodeId: input.nodeId,
      nodeType: input.nodeType,
      displayName: input.displayName,
      approvalStatus: input.approvalStatus,
      trustState: input.trustState,
      enrollmentStatus: input.enrollmentStatus,
      operationalState: input.operationalState,
      presenceState: input.presenceState,
      capabilityProfile: input.capabilityProfile,
      deploymentTags: input.deploymentTags,
      lastSeen: input.lastSeen,
      certificateRef: input.certificateRef,
      revocation: Object.freeze({
        state: input.revocationState,
        reason: input.revocationReason,
        note: input.revocationNote,
        revokedAt: input.revokedAt,
      }),
      enrolledAt: input.enrolledAt,
      requestedAt: input.requestedAt,
      approvedAt: input.approvedAt,
      revokedAt: input.revokedAt,
      pendingEnrollmentRequestId: input.pendingEnrollmentRequestId,
    });
  }

  private toInternalInventoryDetail(
    input: NodeInventoryDetailReadModel,
  ): NodeInternalInventoryDetailDto {
    return Object.freeze({
      ...this.toInternalInventorySummary(input),
      pendingEnrollment: input.pendingEnrollment
        ? Object.freeze({
          requestId: input.pendingEnrollment.requestId,
          status: input.pendingEnrollment.status,
          requestedAt: input.pendingEnrollment.requestedAt,
          reviewedAt: input.pendingEnrollment.reviewedAt,
          decisionNote: input.pendingEnrollment.decisionNote,
          certificateRef: input.pendingEnrollment.certificateRef,
        })
        : undefined,
    });
  }

  private mapUseCaseError(code: string, message: string): NodeTrustApiError {
    switch (code) {
      case NodeTrustUseCaseErrorCodes.invalidRequest:
        return Object.freeze({
          code: NodeTrustApiErrorCodes.invalidRequest,
          message,
        });
      case NodeTrustUseCaseErrorCodes.forbidden:
        return Object.freeze({
          code: NodeTrustApiErrorCodes.forbidden,
          message,
        });
      case NodeTrustUseCaseErrorCodes.notFound:
        return Object.freeze({
          code: NodeTrustApiErrorCodes.notFound,
          message,
        });
      case NodeTrustUseCaseErrorCodes.conflict:
      case NodeTrustUseCaseErrorCodes.invalidState:
        return Object.freeze({
          code: NodeTrustApiErrorCodes.conflict,
          message,
        });
      default:
        return Object.freeze({
          code: NodeTrustApiErrorCodes.internal,
          message,
        });
    }
  }
}
