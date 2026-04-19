import {
  type ContractError,
  type ContractErrorDetails,
  type ContractResult,
  createFailureResult,
  createSuccessResult,
} from "../shared";
import {
  normalizeIngestWebsitePageSuccessValue,
  type IngestWebsitePageSuccessValue,
} from "./ingest-website-page-result";

export interface IngestWebsitePagesBatchSummary {
  attempted: number;
  succeeded: number;
  failed: number;
}

export interface IngestWebsitePagesBatchSuccessValue {
  items: IngestWebsitePageSuccessValue[];
  summary: IngestWebsitePagesBatchSummary;
}

export type IngestWebsitePagesBatchResult<
  TDetails extends ContractErrorDetails = ContractErrorDetails,
> = ContractResult<IngestWebsitePagesBatchSuccessValue, TDetails>;

export function normalizeIngestWebsitePagesBatchSuccessValue(
  value: IngestWebsitePagesBatchSuccessValue,
): IngestWebsitePagesBatchSuccessValue {
  const items = value.items.map((item) => normalizeIngestWebsitePageSuccessValue(item));
  const attempted = items.length;

  if (value.summary.attempted !== attempted) {
    throw new Error(`Batch summary attempted count must equal item count (${attempted}).`);
  }

  if (value.summary.succeeded + value.summary.failed !== attempted) {
    throw new Error("Batch summary counts must satisfy succeeded + failed === attempted.");
  }

  return {
    items,
    summary: {
      attempted,
      succeeded: value.summary.succeeded,
      failed: value.summary.failed,
    },
  };
}

export function createIngestWebsitePagesBatchSuccessResult<
  TDetails extends ContractErrorDetails = ContractErrorDetails,
>(
  value: IngestWebsitePagesBatchSuccessValue,
): IngestWebsitePagesBatchResult<TDetails> {
  return createSuccessResult(normalizeIngestWebsitePagesBatchSuccessValue(value));
}

export function createIngestWebsitePagesBatchFailureResult<
  TDetails extends ContractErrorDetails = ContractErrorDetails,
>(
  error: ContractError<TDetails>,
): IngestWebsitePagesBatchResult<TDetails> {
  return createFailureResult(error);
}
