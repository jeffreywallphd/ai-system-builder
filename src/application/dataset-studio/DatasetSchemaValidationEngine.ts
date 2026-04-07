import {
  createDatasetSchemaValidationResult,
  type IDatasetSchemaIntent,
  type IDatasetSchemaValidationEngine,
} from "@domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import type { CanonicalDataShape } from "@domain/dataset-studio/CanonicalDataShapes";

export class DatasetSchemaValidationEngine implements IDatasetSchemaValidationEngine {
  public validate(input: {
    readonly intent: IDatasetSchemaIntent;
    readonly shape: CanonicalDataShape;
  }) {
    return createDatasetSchemaValidationResult({
      intent: input.intent,
      validation: input.intent.validateShape(input.shape),
    });
  }
}

