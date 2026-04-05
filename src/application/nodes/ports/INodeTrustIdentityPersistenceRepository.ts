import type {
  NodeIdentityPersistenceLookupQuery,
  NodeIdentityPersistenceRecord,
  NodeTrustPersistenceMutationResult,
  RecordNodeLastSeenPersistenceRecordInput,
  RegisterNodeIdentityPersistenceRecordInput,
  RevokeNodeIdentityPersistenceRecordInput,
  UpdateNodeApprovalPersistenceRecordInput,
  UpdateNodeCapabilityProfilePersistenceRecordInput,
  UpdateNodeCertificateReferencePersistenceRecordInput,
} from "../../../shared/dto/nodes/NodeTrustPersistenceDtos";

export interface INodeTrustIdentityPersistenceRepository {
  findNodeById(nodeId: string): Promise<NodeIdentityPersistenceRecord | undefined>;
  listNodes(query: NodeIdentityPersistenceLookupQuery): Promise<ReadonlyArray<NodeIdentityPersistenceRecord>>;
  registerNode(
    input: RegisterNodeIdentityPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>>;
  updateNodeApproval(
    input: UpdateNodeApprovalPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>>;
  updateNodeCertificateReference(
    input: UpdateNodeCertificateReferencePersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>>;
  updateNodeCapabilityProfile(
    input: UpdateNodeCapabilityProfilePersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>>;
  revokeNode(
    input: RevokeNodeIdentityPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>>;
  recordNodeLastSeen(
    input: RecordNodeLastSeenPersistenceRecordInput,
  ): Promise<NodeTrustPersistenceMutationResult<NodeIdentityPersistenceRecord>>;
}
