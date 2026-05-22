"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskType = void 0;
/**
 * Runtime task type identifiers used by the shared Runtime Task Registry.
 * Values are stable and used across runtime contracts and polling APIs.
 */
var TaskType;
(function (TaskType) {
    TaskType["DATASET_PREPARATION"] = "dataset-preparation";
    TaskType["MODEL_TRAINING"] = "model-training";
    TaskType["MODEL_VALIDATION"] = "model-validation";
    TaskType["MODEL_PUBLISHING"] = "model-publishing";
    TaskType["IMAGE_GENERATION"] = "image-generation";
})(TaskType || (exports.TaskType = TaskType = {}));
