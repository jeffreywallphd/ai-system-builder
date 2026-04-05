import type {
  CertificateSubjectReferenceKind,
} from "../../../domain/security/CertificateAuthorityDomain";
import type {
  CertificateAuthorityPersistenceMutationResult,
  IssuedCertificateLookupQuery,
  IssuedCertificatePersistenceRecord,
  RevokeIssuedCertificatePersistenceRecordInput,
  SaveIssuedCertificatePersistenceRecordInput,
  SupersedeIssuedCertificatePersistenceRecordInput,
} from "../../../shared/dto/security/CertificateAuthorityDtos";

export interface IIssuedCertificatePersistenceRepository {
  findIssuedCertificateBySerialNumber(serialNumber: string): Promise<IssuedCertificatePersistenceRecord | undefined>;
  findLatestIssuedCertificateBySubjectReference(input: {
    readonly kind: CertificateSubjectReferenceKind;
    readonly referenceId: string;
    readonly workspaceId?: string;
  }): Promise<IssuedCertificatePersistenceRecord | undefined>;
  listIssuedCertificates(
    query: IssuedCertificateLookupQuery,
  ): Promise<ReadonlyArray<IssuedCertificatePersistenceRecord>>;
  saveIssuedCertificate(
    input: SaveIssuedCertificatePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<IssuedCertificatePersistenceRecord>>;
  revokeIssuedCertificate(
    input: RevokeIssuedCertificatePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<IssuedCertificatePersistenceRecord>>;
  supersedeIssuedCertificate(
    input: SupersedeIssuedCertificatePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<IssuedCertificatePersistenceRecord>>;
}
