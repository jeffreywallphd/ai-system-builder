import type {
  NodeEnrollmentRequestPersistenceLookupQuery,
  NodeEnrollmentRequestPersistenceRecord,
  NodeTrustPersistenceMutationResult,
  SaveNodeEnrollmentRequestPersistenceRecordInput,
  TransitionNodeEnrollmentRequestPersistenceRecordStatusInput,
} from "../../../shared/dto/nodes/NodeTrustPersistenceDtos";

export interface INodeEnrollmentRequestPersistenceRepository {
  findEnrollmentRequestById(requestId: string): Promise<NodeEnrollmentRequestPersistenceRecord | undefined>;
  findPendingEnrollmentRequestByNodeId(
    nodeId: string,
    asOf?: string,
  ): Promise<NodeEnrollmentRequestPersistenceRecord | undefined>;
  listEnrollmentRequests(
    query: NodeEnrollmentRequestPersistenceLookupQuery,
  ): Promise<ReadonlyArray<NodeEnrollmentRequestPersistenceRecord>>;
  saveEnrollmentRequest(
    input: SaveNodeEnrollmentRequestPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeEnrollmentRequestPersistenceRecord>>;
  transitionEnrollmentRequestStatus(
    input: TransitionNodeEnrollmentRequestPersistenceRecordStatusInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeEnrollmentRequestPersistenceRecord>>;
}
