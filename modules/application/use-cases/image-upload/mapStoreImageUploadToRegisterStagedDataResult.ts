import {
  createRegisterStagedDataFailureResult,
  createRegisterStagedDataSuccessResult,
  createStagedDataDescriptorFromStorageObjectDescriptor,
  type RegisterStagedDataResult,
  type IngestionSourceKind,
  type StagedDataMetadata,
} from "../../../contracts/ingestion";
import type { StorageObjectDescriptor } from "../../../contracts/storage";
import type {
  ContractBoundaryContext,
  ContractError,
  ContractErrorDetails,
} from "../../../contracts/shared";

export function mapStoreImageUploadToRegisterStagedDataResult<
  TDetails extends ContractErrorDetails = ContractErrorDetails,
  TMetadata extends StagedDataMetadata = StagedDataMetadata,
>(
  result:
    | {
      ok: true;
      descriptor: StorageObjectDescriptor<TMetadata>;
      sourceKind: IngestionSourceKind;
      originalName?: string;
      id?: string;
      createdAt?: string;
    }
    | {
      ok: false;
      error: ContractError<TDetails>;
    },
  context?: ContractBoundaryContext,
): RegisterStagedDataResult<TDetails, TMetadata> {
  if (result.ok) {
    return createRegisterStagedDataSuccessResult(
      createStagedDataDescriptorFromStorageObjectDescriptor(result.descriptor, {
        sourceKind: result.sourceKind,
        originalName: result.originalName,
        id: result.id,
        createdAt: result.createdAt,
      }),
      context,
    );
  }

  return createRegisterStagedDataFailureResult(result.error, context);
}
