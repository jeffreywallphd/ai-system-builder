import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import { ValidateModelUseCase } from "../validate-model.use-case";
import { PublishModelUseCase } from "../publish-model.use-case";

describe("ValidateModelUseCase", () => {
  it("updates model validation status", async () => {
    const useCase = new ValidateModelUseCase({
      modelRegistry: {
        getModelRecord: testDouble.fn().mockResolvedValue({ modelRecordId: "m1", localPath: "/tmp/m1", metadata: {} }),
        updateModelRecord: testDouble.fn().mockResolvedValue({ model: {} }),
      } as never,
      modelValidation: {
        validateModel: testDouble.fn().mockResolvedValue({ modelRecordId: "m1", status: "valid", reportPath: "/tmp/report.md" }),
      },
    });

    const result = await useCase.execute({ modelRecordId: "m1" });
    expect(result.status).toBe("valid");
  });
});

describe("PublishModelUseCase", () => {
  it("blocks invalid publish by default", async () => {
    const useCase = new PublishModelUseCase({
      modelRegistry: {
        getModelRecord: testDouble.fn().mockResolvedValue({ modelRecordId: "m1", localPath: "/tmp/m1", validationStatus: "invalid", metadata: {} }),
      } as never,
      modelValidation: { validateModel: testDouble.fn() },
      modelPublisher: { publishModel: testDouble.fn() },
    });

    await expect(useCase.execute({ modelRecordId: "m1", repository: "owner/repo" })).rejects.toThrow(/failed validation/i);
  });
});
