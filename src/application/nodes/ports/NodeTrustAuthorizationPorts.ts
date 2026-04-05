import type {
  NodeEnrollmentRequestPersistenceLookupQuery,
  NodeEnrollmentRequestPersistenceRecord,
  NodeIdentityPersistenceLookupQuery,
  NodeIdentityPersistenceRecord,
  NodeRevocationPersistenceRecord,
} from "../../../shared/dto/nodes/NodeTrustPersistenceDtos";

export interface NodeTrustAuthorizationHook {
  assertCanRegisterEnrollmentRequest(input: {
    readonly actorUserIdentityId: string;
    readonly nodeId: string;
  }): Promise<void>;
  assertCanReviewPendingEnrollment(input: {
    readonly actorUserIdentityId: string;
    readonly nodeId?: string;
  }): Promise<void>;
  assertCanApproveNode(input: {
    readonly actorUserIdentityId: string;
    readonly enrollmentRequest: NodeEnrollmentRequestPersistenceRecord;
    readonly existingNode?: NodeIdentityPersistenceRecord;
  }): Promise<void>;
  assertCanRejectNode(input: {
    readonly actorUserIdentityId: string;
    readonly enrollmentRequest: NodeEnrollmentRequestPersistenceRecord;
    readonly existingNode?: NodeIdentityPersistenceRecord;
  }): Promise<void>;
  assertCanRevokeNode(input: {
    readonly actorUserIdentityId: string;
    readonly node: NodeIdentityPersistenceRecord;
    readonly revocation: NodeRevocationPersistenceRecord;
  }): Promise<void>;
  assertCanRecordHeartbeat(input: {
    readonly actorUserIdentityId: string;
    readonly node: NodeIdentityPersistenceRecord;
  }): Promise<void>;
  assertCanActivateNode?(input: {
    readonly actorUserIdentityId: string;
    readonly node: NodeIdentityPersistenceRecord;
  }): Promise<void>;
  assertCanQueryTrustedNodeInventory(input: {
    readonly actorUserIdentityId: string;
    readonly query: NodeIdentityPersistenceLookupQuery;
  }): Promise<void>;
  assertCanQueryNodeInventory?(input: {
    readonly actorUserIdentityId: string;
    readonly nodeQuery: NodeIdentityPersistenceLookupQuery;
    readonly enrollmentQuery?: NodeEnrollmentRequestPersistenceLookupQuery;
    readonly nodeId?: string;
  }): Promise<void>;
}
