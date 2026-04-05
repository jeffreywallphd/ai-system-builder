import type {
  CertificateAuthorityPersistenceMutationResult,
  SaveTrustMaterialReferencePersistenceRecordInput,
  TrustMaterialReferenceLookupQuery,
  TrustMaterialReferencePersistenceRecord,
} from "../../../shared/dto/security/CertificateAuthorityDtos";

export interface ITrustMaterialReferencePersistenceRepository {
  findTrustMaterialByRef(materialRef: string): Promise<TrustMaterialReferencePersistenceRecord | undefined>;
  listTrustMaterials(
    query: TrustMaterialReferenceLookupQuery,
  ): Promise<ReadonlyArray<TrustMaterialReferencePersistenceRecord>>;
  saveTrustMaterial(
    input: SaveTrustMaterialReferencePersistenceRecordInput,
  ): Promise<CertificateAuthorityPersistenceMutationResult<TrustMaterialReferencePersistenceRecord>>;
}
