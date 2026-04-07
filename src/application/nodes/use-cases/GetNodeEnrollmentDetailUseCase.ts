import type { NodeEnrollmentRequestPersistenceRecord } from "@shared/dto/nodes/NodeTrustPersistenceDtos";
import type { INodeEnrollmentRequestPersistenceRepository } from "../ports/INodeEnrollmentRequestPersistenceRepository";
import type { NodeTrustAuthorizationHook } from "../ports/NodeTrustAuthorizationPorts";
import {
  NodeTrustUseCaseErrorCodes,
  type NodeTrustUseCaseOutcome,
  normalizeRequired,
  toNodeTrustFailure,
} from "./NodeTrustUseCaseShared";

export interface GetNodeEnrollmentDetailUseCaseRequest {
  readonly actorUserIdentityId: string;
  readonly requestId: string;
}

export interface GetNodeEnrollmentDetailUseCaseResponse {
  readonly enrollmentRequest: NodeEnrollmentRequestPersistenceRecord;
}

interface GetNodeEnrollmentDetailUseCaseDependencies {
  readonly enrollmentRequestRepository: INodeEnrollmentRequestPersistenceRepository;
  readonly authorizationHook?: NodeTrustAuthorizationHook;
}

export class GetNodeEnrollmentDetailUseCase {
  public constructor(private readonly dependencies: GetNodeEnrollmentDetailUseCaseDependencies) {}

  public async execute(
    request: GetNodeEnrollmentDetailUseCaseRequest,
  ): Promise<NodeTrustUseCaseOutcome<GetNodeEnrollmentDetailUseCaseResponse>> {
    const actorUserIdentityId = normalizeRequired(request.actorUserIdentityId);
    if (!actorUserIdentityId) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.invalidRequest,
        "actorUserIdentityId is required.",
      );
    }

    const requestId = normalizeRequired(request.requestId);
    if (!requestId) {
      return toNodeTrustFailure(NodeTrustUseCaseErrorCodes.invalidRequest, "requestId is required.");
    }

    const enrollmentRequest = await this.dependencies.enrollmentRequestRepository.findEnrollmentRequestById(requestId);
    if (!enrollmentRequest) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.notFound,
        `Enrollment request '${requestId}' was not found.`,
      );
    }

    try {
      if (this.dependencies.authorizationHook) {
        await this.dependencies.authorizationHook.assertCanReviewPendingEnrollment({
          actorUserIdentityId,
          nodeId: enrollmentRequest.nodeId,
        });
      }
    } catch (error) {
      return toNodeTrustFailure(
        NodeTrustUseCaseErrorCodes.forbidden,
        error instanceof Error ? error.message : "Actor is not authorized to review enrollments.",
      );
    }

    return {
      ok: true,
      value: Object.freeze({
        enrollmentRequest,
      }),
    };
  }
}

