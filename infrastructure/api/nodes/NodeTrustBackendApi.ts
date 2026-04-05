import type {
  RegisterNodeEnrollmentRequestUseCase,
  ReviewPendingNodeEnrollmentUseCase,
} from "../../src/application/nodes/use-cases";
import { NodeTrustUseCaseErrorCodes } from "../../src/application/nodes/use-cases/NodeTrustUseCaseShared";
import {
  toNodeEnrollmentDetailDto,
  toNodePendingEnrollmentSummaryDto,
  type NodeInternalEnrollmentDetailDto,
} from "../../src/shared/contracts/nodes/NodeTrustApiContracts";
import type { NodeEnrollmentRequestPersistenceRecord } from "../../src/shared/dto/nodes/NodeTrustPersistenceDtos";
import {
  NodeTrustApiErrorCodes,
  type ListPendingNodeEnrollmentsApiRequest,
  type ListPendingNodeEnrollmentsApiResponse,
  type NodeTrustApiError,
  type NodeTrustApiResponse,
  type SubmitNodeEnrollmentApiRequest,
  type SubmitNodeEnrollmentApiResponse,
} from "./sdk/PublicNodeTrustApiContract";

interface NodeTrustBackendApiDependencies {
  readonly registerNodeEnrollmentRequestUseCase: RegisterNodeEnrollmentRequestUseCase;
  readonly reviewPendingNodeEnrollmentUseCase: ReviewPendingNodeEnrollmentUseCase;
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
