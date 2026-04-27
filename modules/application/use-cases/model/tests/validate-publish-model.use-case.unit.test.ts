import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import { ValidateModelUseCase } from "../validate-model.use-case";
import { PublishModelUseCase } from "../publish-model.use-case";

describe("ValidateModelUseCase", () => {
  it("updates model validation status", async () => {
    const updateModelRecord = testDouble.fn().mockResolvedValue({ model: {} });
    const useCase = new ValidateModelUseCase({
      modelRegistry: {
        getModelRecord: testDouble.fn().mockResolvedValue({
          modelRecordId: "m1",
          localPath: "/tmp/m1",
          lifecycleStatus: "generated",
          metadata: { stale: true },
        }),
        updateModelRecord,
      } as never,
      modelValidation: {
        validateModel: testDouble.fn().mockResolvedValue({ modelRecordId: "m1", status: "valid", reportPath: "/tmp/report.md" }),
      },
    });

    const result = await useCase.execute({ modelRecordId: "m1" });
    expect(result.status).toBe("valid");
    const firstCall = updateModelRecord.mock.calls[0]?.[0] as { patch: { lifecycleStatus?: string } };
    expect(firstCall.patch.lifecycleStatus).toBe("validated");
  });

  it("preserves lifecycle status on warning and marks invalid explicitly", async () => {
    const updateModelRecord = testDouble.fn().mockResolvedValue({ model: {} });
    let callCount = 0;
    const getModelRecord = testDouble.fn(async () => {
      callCount += 1;
      return { modelRecordId: "m1", localPath: "/tmp/m1", lifecycleStatus: "generated", metadata: { callCount } };
    });
    const validateModel = testDouble.fn(async () => (
      callCount === 1
        ? { modelRecordId: "m1", status: "warning", reportPath: "/tmp/report-warning.md" }
        : { modelRecordId: "m1", status: "invalid", reportPath: "/tmp/report-invalid.md", warnings: [], errors: ["broken"] }
    ));

    const useCase = new ValidateModelUseCase({
      modelRegistry: { getModelRecord, updateModelRecord } as never,
      modelValidation: { validateModel },
    });

    await useCase.execute({ modelRecordId: "m1" });
    await useCase.execute({ modelRecordId: "m1" });

    const firstPatch = updateModelRecord.mock.calls[0]?.[0]?.patch as { validationStatus?: string; lifecycleStatus?: string };
    const secondPatch = updateModelRecord.mock.calls[1]?.[0]?.patch as { validationStatus?: string; lifecycleStatus?: string };
    expect(firstPatch.validationStatus).toBe("warning");
    expect(firstPatch.lifecycleStatus).toBe("generated");
    expect(secondPatch.validationStatus).toBe("invalid");
    expect(secondPatch.lifecycleStatus).toBe("invalid");
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

  it("preserves local identity and stores published summary metadata", async () => {
    const updateModelRecord = testDouble.fn().mockResolvedValue({ model: {} });
    const publishModel = testDouble.fn().mockResolvedValue({
      modelRecordId: "m1",
      published: true,
      provider: "huggingface",
      repository: "owner/repo",
      revision: "main",
      url: "https://huggingface.co/owner/repo",
    });
    const useCase = new PublishModelUseCase({
      modelRegistry: {
        getModelRecord: testDouble.fn().mockResolvedValue({
          modelRecordId: "m1",
          modelId: "generated-local-id",
          source: "generated",
          provider: "unknown",
          lifecycleStatus: "generated",
          localPath: "/tmp/m1",
          metadata: { existing: true },
        }),
        updateModelRecord,
      } as never,
      modelValidation: { validateModel: testDouble.fn().mockResolvedValue({ status: "valid" }) } as never,
      modelPublisher: { publishModel },
    });

    await useCase.execute({ modelRecordId: "m1", repository: "owner/repo", revision: "main" });

    expect(publishModel).toHaveBeenCalled();
    const patch = updateModelRecord.mock.calls[0]?.[0]?.patch as Record<string, unknown>;
    expect((patch.published as { provider: string }).provider).toBe("huggingface");
    expect((patch.published as { repository: string }).repository).toBe("owner/repo");
    expect((patch.published as { revision: string }).revision).toBe("main");
    expect(patch.provider).toBeUndefined();
    expect(patch.source).toBeUndefined();
    expect(patch.modelId).toBeUndefined();
    expect(patch.lifecycleStatus).toBeUndefined();
  });
});
