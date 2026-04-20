import {
  PrepareTrainingDatasetRequest,
  PrepareTrainingDatasetResult,
} from "../../../contracts/runtime";

export interface PythonDatasetPreparationPort {
  prepareTrainingDataset(
    request: PrepareTrainingDatasetRequest
  ): Promise<PrepareTrainingDatasetResult>;
}
