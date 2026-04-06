import type {
  IdentityCredentialHistoryQuery,
  IdentityCredentialMaterialRecord,
  IdentityPersistenceMutationContext,
  IdentityPersistenceMutationResult,
  IdentityProviderSubjectReference,
} from "../../../shared/dto/identity/IdentityPersistenceDtos";

export interface ICredentialMaterialQueryRepository {
  getActiveCredentialMaterial(
    reference: IdentityProviderSubjectReference,
  ): Promise<IdentityCredentialMaterialRecord | undefined>;
  listCredentialMaterialHistory(
    query: IdentityCredentialHistoryQuery,
  ): Promise<ReadonlyArray<IdentityCredentialMaterialRecord>>;
}

export interface ICredentialMaterialWriteRepository {
  saveCredentialMaterial(
    record: IdentityCredentialMaterialRecord,
    mutation?: IdentityPersistenceMutationContext,
  ): Promise<IdentityPersistenceMutationResult<IdentityCredentialMaterialRecord>>;
  markCredentialMaterialSuperseded(
    recordId: string,
    supersededAt: string,
    mutation?: IdentityPersistenceMutationContext,
  ): Promise<IdentityPersistenceMutationResult<IdentityCredentialMaterialRecord | undefined>>;
}

export interface ICredentialMaterialRepository
  extends ICredentialMaterialQueryRepository, ICredentialMaterialWriteRepository {}
