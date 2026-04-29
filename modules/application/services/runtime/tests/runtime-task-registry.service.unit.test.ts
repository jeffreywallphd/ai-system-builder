import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import { TaskType, type RuntimeTaskRecord } from "../../../../contracts/runtime";
import type { RuntimeTaskRegistryPort } from "../../../ports/runtime";
import type { TaskPowerLifecyclePort } from "../task-power-lifecycle.service";
import { RuntimeTaskRegistryService } from "../runtime-task-registry.service";

function createRegistryPortMock(): RuntimeTaskRegistryPort {
  return {
    startTask: testDouble.fn(async () => ({ requestId: "r-1" })),
    getTaskStatus: testDouble.fn(async (): Promise<RuntimeTaskRecord> => ({
      requestId: "r-1",
      taskType: TaskType.MODEL_TRAINING,
      status: "succeeded",
      concurrencyClass: "gpu-exclusive",
    })),
    cancelTask: testDouble.fn(async () => ({ requestId: "r-1", status: "cancelled", cancelled: true })),
    listTasks: testDouble.fn(async () => ({ tasks: [] })),
  };
}

function createLifecycleMock(): TaskPowerLifecyclePort {
  return {
    startTask: testDouble.fn(async () => undefined),
    completeTask: testDouble.fn(async () => undefined),
  };
}

describe("RuntimeTaskRegistryService", () => {
  it("delegates start and attaches power lifecycle", async () => {
    const registry = createRegistryPortMock();
    const lifecycle = createLifecycleMock();
    const service = new RuntimeTaskRegistryService(registry, lifecycle);

    const result = await service.startAndAttachLifecycle({
      taskType: TaskType.MODEL_TRAINING,
      concurrencyClass: "gpu-exclusive",
      payload: { run: true },
    });

    expect(result.requestId).toBe("r-1");
    expect(registry.startTask).toHaveBeenCalledTimes(1);
    expect(lifecycle.startTask).toHaveBeenCalledTimes(1);
  });

  it("safeCancel swallows port failures", async () => {
    const registry = createRegistryPortMock();
    registry.cancelTask = testDouble.fn(async () => { throw new Error("boom"); });
    const lifecycle = createLifecycleMock();
    const service = new RuntimeTaskRegistryService(registry, lifecycle);

    await expect(service.safeCancel("r-1")).resolves.toBeUndefined();
  });

  it("waitForTerminalStatus swallows lifecycle failures", async () => {
    const registry = createRegistryPortMock();
    const lifecycle = createLifecycleMock();
    lifecycle.completeTask = testDouble.fn(async () => { throw new Error("boom"); });
    const service = new RuntimeTaskRegistryService(registry, lifecycle);

    const record = await service.waitForTerminalStatus("r-1");
    expect(record.status).toBe("succeeded");
  });
});
