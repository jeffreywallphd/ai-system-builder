import type {
  PersistenceRecordReference,
  PersistenceResult,
} from "../../../contracts/persistence";
import type { ContractBoundaryContext } from "../../../contracts/shared";

export interface LoadPersistenceRecordRequest extends ContractBoundaryContext {
  record: PersistenceRecordReference;
}

export interface SavePersistenceRecordRequest<TValue = unknown>
  extends ContractBoundaryContext {
  record: PersistenceRecordReference;
  value: TValue;
}

export interface DeletePersistenceRecordRequest extends ContractBoundaryContext {
  record: PersistenceRecordReference;
}

export interface PersistenceRecordPort {
  loadRecord<TValue = unknown>(
    request: LoadPersistenceRecordRequest,
  ): Promise<PersistenceResult<TValue | null>>;

  saveRecord<TValue = unknown>(
    request: SavePersistenceRecordRequest<TValue>,
  ): Promise<PersistenceResult<TValue>>;

  deleteRecord(
    request: DeletePersistenceRecordRequest,
  ): Promise<PersistenceResult<boolean>>;
}
