import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import type { PythonRuntimePort } from "../../../../application/ports/runtime";
import { createPythonModelTrainingPort } from "../createPythonModelTrainingPort";

describe("createPythonModelTrainingPort", () => {
  const request = {
    baseModel: { modelRecordId: "base-1" },
    datasets: [{ artifactId: "dataset-1", splitRole: "train" as const }],
    method: "lora" as const,
    commonParameters: {},
    output: { outputModelName: "demo-adapter", destination: { local: { enabled: true } } },
  };

  it("maps training request to runtime task and maps successful result", async () => {
    const executeTask = testDouble.fn<PythonRuntimePort["executeTask"]>().mockResolvedValue({
      requestId: "req-1",
      taskType: "train-model",
      success: true,
      data: {
        runId: "run-1",
        status: "succeeded",
        outputDirectory: "/tmp/output",
        outputModelName: "demo-adapter",
        warnings: ["skeleton"],
      },
    });

    const port = createPythonModelTrainingPort({
      executeTask,
      getHealthStatus: testDouble.fn(),
      getCapabilities: testDouble.fn(),
      ensureModelDownloaded: testDouble.fn(),
      getModelStatus: testDouble.fn(),
      unloadModels: testDouble.fn(),
    });

    const result = await port.trainModel(request);
    expect(executeTask.mock.calls[0]?.[0]?.taskType).toBe("train-model");
    expect(result.status).toBe("succeeded");
    expect(result.outputModelName).toBe("demo-adapter");
  });

  it("maps runtime failures with warnings/details", async () => {
    const port = createPythonModelTrainingPort({
      executeTask: testDouble.fn<PythonRuntimePort["executeTask"]>().mockResolvedValue({
        requestId: "req-2",
        taskType: "train-model",
        success: false,
        error: {
          code: "task_failed",
          message: "not supported",
          details: { warnings: ["lora only"] },
        },
      }),
      getHealthStatus: testDouble.fn(),
      getCapabilities: testDouble.fn(),
      ensureModelDownloaded: testDouble.fn(),
      getModelStatus: testDouble.fn(),
      unloadModels: testDouble.fn(),
    });

    const result = await port.trainModel(request);
    expect(result.status).toBe("failed");
    expect(result.warnings).toEqual(["lora only"]);
  });
});
