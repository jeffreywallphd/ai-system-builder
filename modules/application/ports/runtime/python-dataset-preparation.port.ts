import {
  PrepareTemplatedDatasetRequest,
  PrepareTemplatedDatasetResult
} from "../../../contracts/runtime";

export interface PythonDatasetPreparationPort {
  prepareTemplatedDataset(
    request: PrepareTemplatedDatasetRequest
  ): Promise<PrepareTemplatedDatasetResult>;
}
