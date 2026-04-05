import type { NodeCapabilityProfilePersistenceRecord } from "../../../shared/dto/nodes/NodeTrustPersistenceDtos";

export interface ApprovedNodeCertificateEligibilityInput {
  readonly nodeId: string;
}

export interface ApprovedNodeCertificateEligibilityMetadata {
  readonly nodeId: string;
  readonly enrollmentRequestId: string;
  readonly capabilityProfile: NodeCapabilityProfilePersistenceRecord;
}

export type ApprovedNodeCertificateEligibilityDecision =
  | {
    readonly eligible: true;
    readonly metadata: ApprovedNodeCertificateEligibilityMetadata;
  }
  | {
    readonly eligible: false;
    readonly violations: ReadonlyArray<string>;
  };

export interface INodeCertificateEligibilityPort {
  resolveApprovedNodeCertificateEligibility(
    input: ApprovedNodeCertificateEligibilityInput,
  ): Promise<ApprovedNodeCertificateEligibilityDecision>;
}
