import { describe, expect, it } from "../../../testing/node-test";

import * as modelContracts from "..";

describe("model family invariants", () => {
  it("exports only model-family surfaces from the family barrel", () => {
    expect(Object.keys(modelContracts).sort()).toEqual([
      "DEFAULT_BROWSE_MODELS_LIMIT",
      "DEFAULT_LIST_MODELS_LIMIT",
      "MAX_BROWSE_MODELS_LIMIT",
      "MAX_LIST_MODELS_LIMIT",
      "MODEL_BROWSE_PROVIDERS",
      "MODEL_INFERENCE_MODES",
      "MODEL_TRAINING_METHODS",
      "MODEL_TRAINING_STATUSES",
      "MODEL_VALIDATION_STATUSES",
      "normalizeBrowseModelsRequest",
      "normalizeBrowseModelsResult",
      "normalizeDeleteModelRecordRequest",
      "normalizeGetModelDetailsRequest",
      "normalizeGetModelDetailsResult",
      "normalizeListModelsRequest",
      "normalizeListModelsResult",
      "normalizeModelBrowseItem",
      "normalizeModelBrowseProvider",
      "normalizeModelDetails",
      "normalizeModelInferenceMode",
      "normalizeModelInventoryRecord",
      "normalizeModelValidationStatus",
      "normalizeModelValidationSummary",
      "normalizeRegisterDownloadedModelRequest",
      "normalizeRegisterGeneratedModelRequest",
      "normalizeSaveModelReferenceRequest",
      "normalizeUpdateModelRecordRequest",
      "recommendModelInferenceMode",
    ].sort());
  });
});
