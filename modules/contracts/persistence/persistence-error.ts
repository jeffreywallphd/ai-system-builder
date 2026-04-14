import type {
  ContractError,
  ContractErrorCode,
  ContractErrorDetails,
} from "../shared";
import { createContractError } from "../shared";
import type { PersistenceRecordReference } from "./persistence-record-reference";

export type PersistenceFailureDetails = ContractErrorDetails;

export interface PersistenceError<
  TDetails extends PersistenceFailureDetails = PersistenceFailureDetails,
> extends ContractError<TDetails> {
  operation: string;
  record?: PersistenceRecordReference;
}

export function createPersistenceError<
  TDetails extends PersistenceFailureDetails = PersistenceFailureDetails,
>(
  operation: string,
  code: ContractErrorCode,
  message: string,
  options?: {
    details?: TDetails;
    requestId?: string;
    correlationId?: string;
    record?: PersistenceRecordReference;
  },
): PersistenceError<TDetails> {
  return {
    ...createContractError(code, message, {
      details: options?.details,
      requestId: options?.requestId,
      correlationId: options?.correlationId,
    }),
    operation,
    record: options?.record,
  };
}

