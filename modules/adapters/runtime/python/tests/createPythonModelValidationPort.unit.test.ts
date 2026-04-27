import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import type { PythonRuntimePort } from "../../../../application/ports/runtime";
import { createPythonModelValidationPort } from "../createPythonModelValidationPort";

describe("createPythonModelValidationPort", () => {
  it("maps validation task responses", async () => {
    const port = createPythonModelValidationPort({
      executeTask: testDouble.fn<PythonRuntimePort["executeTask"]>().mockResolvedValue({
        requestId: "req-1",
        taskType: "validate-model",
        success: true,
        data: {
          modelRecordId: "m1",
          status: "valid",
          validationReportPath: "/tmp/report.md",
          serializationFormat: "safetensors",
          shardCount: 1,
        },
      }),
      getHealthStatus: testDouble.fn(),
      getCapabilities: testDouble.fn(),
      ensureModelDownloaded: testDouble.fn(),
      getModelStatus: testDouble.fn(),
      unloadModels: testDouble.fn(),
    });

    const result = await port.validateModel({ modelRecordId: "m1", modelPath: "/tmp/model" });
    expect(result.status).toBe("valid");
    expect(result.reportPath).toBe("/tmp/report.md");
  });
});
