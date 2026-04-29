import { TaskType } from "../../../../contracts/runtime";
import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import { ValidateModelUseCase } from "../validate-model.use-case";
import { PublishModelUseCase } from "../publish-model.use-case";

describe("ValidateModelUseCase", () => {
  it("starts validation via runtime task registry", async () => {
    const startTask = testDouble.fn().mockResolvedValue({ requestId: "req-validate-1" });
    const useCase = new ValidateModelUseCase({
      modelRegistry: { getModelRecord: testDouble.fn().mockResolvedValue({ modelRecordId: "m1", localPath: "/tmp/m1" }) } as never,
      runtimeTaskRegistry: { startTask, getTaskStatus: testDouble.fn(), cancelTask: testDouble.fn(), listTasks: testDouble.fn() } as never,
    });
    const result = await useCase.execute({ modelRecordId: "m1" });
    expect(result.requestId).toBe("req-validate-1");
    expect(startTask).toHaveBeenCalledWith({ taskType: TaskType.MODEL_VALIDATION, payload: { modelRecordId: "m1", modelPath: "/tmp/m1", validationStrictness: "normal" } });
  });

  it("reads succeeded validation status and updates model record", async () => {
    const updateModelRecord = testDouble.fn().mockResolvedValue({ model: {} });
    const useCase = new ValidateModelUseCase({
      modelRegistry: { getModelRecord: testDouble.fn().mockResolvedValue({ modelRecordId: "m1", lifecycleStatus: "generated", metadata: {} }), updateModelRecord } as never,
      runtimeTaskRegistry: { startTask: testDouble.fn(), getTaskStatus: testDouble.fn().mockResolvedValue({ requestId: "req-1", taskType: TaskType.MODEL_VALIDATION, status: "succeeded", data: { modelRecordId: "m1", status: "valid", reportPath: "/tmp/report.md", validationStrictness: "normal" } }), cancelTask: testDouble.fn(), listTasks: testDouble.fn() } as never,
    });
    const result = await useCase.read("req-1");
    expect(result.status).toBe("valid");
    expect(updateModelRecord).toHaveBeenCalled();
  });
});

describe("PublishModelUseCase", () => {
  it("starts publishing via runtime task registry", async () => {
    const startTask = testDouble.fn().mockResolvedValue({ requestId: "req-publish-1" });
    const useCase = new PublishModelUseCase({
      modelRegistry: { getModelRecord: testDouble.fn().mockResolvedValue({ modelRecordId: "m1", localPath: "/tmp/m1" }) } as never,
      runtimeTaskRegistry: { startTask, getTaskStatus: testDouble.fn(), cancelTask: testDouble.fn(), listTasks: testDouble.fn() } as never,
    });
    const result = await useCase.execute({ modelRecordId: "m1", repository: "owner/repo" });
    expect(result.requestId).toBe("req-publish-1");
    expect(startTask).toHaveBeenCalledWith({ taskType: TaskType.MODEL_PUBLISHING, payload: { modelRecordId: "m1", repository: "owner/repo" } });
  });
});
