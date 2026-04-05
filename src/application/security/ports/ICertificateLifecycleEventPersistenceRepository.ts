import type {
  AppendCertificateStatusHistoryPersistenceRecordInput,
  CertificateAuthorityPersistenceMutationResult,
  CertificateDistributionEventLookupQuery,
  CertificateDistributionEventPersistenceRecord,
  CertificateRevocationHistoryLookupQuery,
  CertificateRevocationHistoryPersistenceRecord,
  CertificateStatusHistoryLookupQuery,
  CertificateStatusHistoryPersistenceRecord,
  SaveCertificateDistributionEventPersistenceRecordInput,
  SaveCertificateRevocationHistoryPersistenceRecordInput,
} from "../../../shared/dto/security/CertificateAuthorityDtos";

export interface ICertificateLifecycleEventPersistenceRepository {
  findLatestStatusEventBySerialNumber(
    serialNumber: string,
  ): Promise<CertificateStatusHistoryPersistenceRecord | undefined>;
  listCertificateStatusHistory(
    query: CertificateStatusHistoryLookupQuery,
  ): Promise<ReadonlyArray<CertificateStatusHistoryPersistenceRecord>>;
  appendCertificateStatusHistory(
    input: AppendCertificateStatusHistoryPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateStatusHistoryPersistenceRecord>>;

  findLatestCertificateRevocationBySerialNumber(
    serialNumber: string,
  ): Promise<CertificateRevocationHistoryPersistenceRecord | undefined>;
  listCertificateRevocations(
    query: CertificateRevocationHistoryLookupQuery,
  ): Promise<ReadonlyArray<CertificateRevocationHistoryPersistenceRecord>>;
  saveCertificateRevocation(
    input: SaveCertificateRevocationHistoryPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateRevocationHistoryPersistenceRecord>>;

  listCertificateDistributionEvents(
    query: CertificateDistributionEventLookupQuery,
  ): Promise<ReadonlyArray<CertificateDistributionEventPersistenceRecord>>;
  saveCertificateDistributionEvent(
    input: SaveCertificateDistributionEventPersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<CertificateDistributionEventPersistenceRecord>>;
}
