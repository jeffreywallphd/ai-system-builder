import type {
  IdentityCredentialHistoryQuery,
  IdentityCredentialMaterialRecord,
  IdentityMutationOutcome,
  IdentityOperationResult,
  IdentityProviderSubjectReference,
} from "../../contracts/IdentityApplicationContracts";
import { IdentityErrorCodes } from "../../contracts/IdentityApplicationContracts";

export interface ICredentialMaterialRepository {
  getActiveCredentialMaterial(reference: IdentityProviderSubjectReference): Promise<IdentityCredentialMaterialRecord | undefined>;
  listCredentialMaterialHistory(query: IdentityCredentialHistoryQuery): Promise<ReadonlyArray<IdentityCredentialMaterialRecord>>;
  saveCredentialMaterial(record: IdentityCredentialMaterialRecord): Promise<IdentityCredentialMaterialRecord>;
  markCredentialMaterialSuperseded(
    recordId: string,
    supersededAt: string,
  ): Promise<IdentityOperationResult<IdentityMutationOutcome, typeof IdentityErrorCodes.invalidRequest>>;
}
