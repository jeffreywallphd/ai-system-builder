import type {
  NodeCapabilityProfilePersistenceRecord,
  NodeCertificateReferencePersistenceRecord,
} from "../../../shared/dto/nodes/NodeTrustPersistenceDtos";
import type { NodeType } from "../../../domain/nodes/NodeTrustDomain";

export interface IssueNodeCertificateHookInput {
  readonly actorUserIdentityId: string;
  readonly nodeId: string;
  readonly nodeType: NodeType;
  readonly displayName: string;
  readonly capabilityProfile: NodeCapabilityProfilePersistenceRecord;
  readonly enrollmentRequestId: string;
  readonly requestedAt: string;
}

export interface NodeTrustCertificateHook {
  issueNodeCertificate(input: IssueNodeCertificateHookInput): Promise<NodeCertificateReferencePersistenceRecord>;
  revokeNodeCertificate?(input: {
    readonly actorUserIdentityId: string;
    readonly nodeId: string;
    readonly certificateRef: string;
    readonly revokedAt: string;
    readonly reason?: string;
  }): Promise<void>;
}
