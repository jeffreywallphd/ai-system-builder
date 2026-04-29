import { describe, expect, it } from "../../../testing/node-test";

import {
  type RuntimeTaskConcurrencyClass,
  type RuntimeTaskIdentity,
  type RuntimeTaskLifecycleStatus,
} from "../index";

describe("runtime domain", () => {
  it("models runtime task identity with requestId and taskType", () => {
    const identity: RuntimeTaskIdentity = {
      requestId: "req-1",
      taskType: "model-training",
    };

    expect(identity.taskType).toBe("model-training");
  });

  it("supports shared lifecycle status values", () => {
    const status: RuntimeTaskLifecycleStatus = "running";
    expect(status).toBe("running");
  });

  it("supports shared runtime concurrency classes", () => {
    const concurrencyClass: RuntimeTaskConcurrencyClass = "gpu-exclusive";
    expect(concurrencyClass).toBe("gpu-exclusive");
  });
});
