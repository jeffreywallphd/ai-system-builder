import {
  PythonRuntimeTaskStatusResult,
  PrepareTrainingDatasetRequest,
} from "../../../contracts/runtime";
import type { ContractError } from "../../../contracts/shared";

export class PythonDatasetPreparationError extends Error {
  public readonly contractError: ContractError;

  public constructor(contractError: ContractError) {
    super(contractError.message);
    this.name = "PythonDatasetPreparationError";
    this.contractError = contractError;
  }
}

export interface PythonDatasetPreparationPort {
  startPrepareTrainingDataset(
    request: PrepareTrainingDatasetRequest,
    context?: {
      requestId?: string;
      correlationId?: string;
    },
  ): Promise<{ requestId: string }>;
  readPrepareTrainingDatasetStatus(requestId: string): Promise<PythonRuntimeTaskStatusResult>;
  cancelPrepareTrainingDataset?(requestId: string): Promise<boolean>;
}
