import { describe, expect, expectTypeOf, it } from "../../testing/node-test";

import type { LocalModelConfig } from "../runtime";
import {
  MODEL_BROWSE_PROVIDERS,
  MODEL_INFERENCE_MODES,
  MODEL_TRAINING_METHODS,
  MODEL_TRAINING_STATUSES,
  MODEL_VALIDATION_STATUSES,
  normalizeBrowseModelsRequest,
  normalizeBrowseModelsResult,
  normalizeModelInferenceMode,
  normalizeModelInventoryRecord,
  normalizeModelValidationSummary,
  type BrowseModelsResult,
  type ModelInferenceMode,
  type ModelInventoryRecord,
  type ModelTrainingRequest,
  type ModelTrainingResult,
} from ".";

describe("model contracts", () => {
  it("defines browse providers and inference modes", () => {
    expect(MODEL_BROWSE_PROVIDERS).toEqual(["huggingface"]);
    expect(MODEL_INFERENCE_MODES).toEqual(["text2text", "causal", "chat"]);
    expect(normalizeModelInferenceMode(" chat ")).toBe("chat");
    expectTypeOf<ModelInferenceMode>().toExtend<Exclude<NonNullable<LocalModelConfig["inferenceMode"]>, "auto">>();
  });

  it("normalizes browse request and result shapes", () => {
    const request = normalizeBrowseModelsRequest({
      provider: "huggingface",
      query: " mistral ",
      taskTags: ["summarization", " chat "],
      authorOrOrg: " mistralai ",
      limit: 25,
      cursor: " next ",
      sort: "downloads",
      direction: "desc",
    });

    expect(request).toEqual({
      provider: "huggingface",
      query: "mistral",
      taskTags: ["summarization", "chat"],
      authorOrOrg: "mistralai",
      limit: 25,
      cursor: "next",
      sort: "downloads",
      direction: "desc",
    });

    const result: BrowseModelsResult = normalizeBrowseModelsResult({
      models: [{
        provider: "huggingface",
        modelId: " mistralai/Mistral-7B-Instruct-v0.2 ",
        displayName: " Mistral 7B Instruct ",
        taskTags: ["text-generation", "chat"],
        inferenceMode: "causal",
      }],
      nextCursor: " page-2 ",
    });

    expect(result.models[0]).toMatchObject({
      modelId: "mistralai/Mistral-7B-Instruct-v0.2",
      displayName: "Mistral 7B Instruct",
      taskTags: ["text-generation", "chat"],
      inferenceMode: "causal",
    });
    expect(result.nextCursor).toBe("page-2");
  });

  it("normalizes inventory records with model vocabulary types", () => {
    const record: ModelInventoryRecord = normalizeModelInventoryRecord({
      modelRecordId: " model-001 ",
      displayName: " Mistral 7B Instruct ",
      source: "huggingface",
      lifecycleStatus: "downloaded",
      artifactForm: "full-model",
      provider: "huggingface",
      modelId: " mistralai/Mistral-7B-Instruct-v0.2 ",
      createdAt: " 2026-04-27T00:00:00.000Z ",
      taskTags: ["text-generation", "chat"],
      inferenceMode: "causal",
      serializationFormat: "safetensors",
      validationStatus: "valid",
    });

    expect(record).toMatchObject({
      modelRecordId: "model-001",
      displayName: "Mistral 7B Instruct",
      modelId: "mistralai/Mistral-7B-Instruct-v0.2",
      taskTags: ["text-generation", "chat"],
      inferenceMode: "causal",
      serializationFormat: "safetensors",
      validationStatus: "valid",
    });
  });

  it("supports model training request/result and validation report shapes", () => {
    const request: ModelTrainingRequest = {
      baseModel: {
        provider: "huggingface",
        modelId: "mistralai/Mistral-7B-Instruct-v0.2",
        inferenceMode: "causal",
      },
      datasets: [{ artifactId: "artifact-001", splitRole: "train", format: "jsonl" }],
      method: "qlora",
      commonParameters: {
        numEpochs: 3,
        batchSize: 2,
        learningRate: 0.0002,
      },
      advancedParameters: {
        gradientAccumulationSteps: 8,
        mixedPrecision: "bf16",
        lora: { rank: 16, alpha: 32, dropout: 0.05 },
        quantization: { loadIn4Bit: true, bnb4BitQuantType: "nf4" },
      },
      output: {
        outputModelName: "mistral-7b-instruct-qlora-demo",
        destination: {
          local: { enabled: true },
          huggingFace: { enabled: false, provider: "huggingface" },
        },
      },
      validation: { enabled: true, expectedLoRA: true },
    };

    const result: ModelTrainingResult = {
      runId: "run-001",
      status: "queued",
      warnings: ["pending scheduler assignment"],
    };

    expect(request.method).toBe("qlora");
    expect(result.status).toBe("queued");
    expect(MODEL_TRAINING_METHODS).toEqual(["lora", "qlora", "full-finetune"]);
    expect(MODEL_TRAINING_STATUSES).toEqual(["queued", "running", "succeeded", "failed", "cancelled"]);

    const validation = normalizeModelValidationSummary({
      status: "warning",
      serializationFormat: "sharded-safetensors",
      shardCount: 4,
      warnings: [" missing tokenizer config "],
    });

    expect(validation).toEqual({
      status: "warning",
      checkedAt: undefined,
      reportPath: undefined,
      expectedLoRA: undefined,
      expectedRecurrentAdditions: undefined,
      detectedLoRA: undefined,
      detectedRecurrentAdditions: undefined,
      serializationFormat: "sharded-safetensors",
      shardCount: 4,
      warnings: ["missing tokenizer config"],
      errors: undefined,
    });
    expect(MODEL_VALIDATION_STATUSES).toEqual(["unknown", "valid", "invalid", "warning"]);
  });
});
