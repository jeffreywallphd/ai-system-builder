import { describe, expect, it } from "bun:test";
import { RuntimeBackendRunRealtimePublisher } from "../RuntimeBackendRunRealtimePublisher";

describe("RuntimeBackendRunRealtimePublisher", () => {
  it("delegates run and queue publication to system runtime backend api", () => {
    const published = {
      run: [] as unknown[],
      queue: [] as unknown[],
    };
    const publisher = new RuntimeBackendRunRealtimePublisher({
      publishRuntimeRunStatus: (input) => {
        published.run.push(input);
        return {} as never;
      },
      publishRuntimeQueueMovement: (input) => {
        published.queue.push(input);
        return {} as never;
      },
    });

    publisher.publishRunStatus({
      actorUserIdentityId: "user-1",
      workspaceId: "workspace-a",
      payload: {
        executionId: "run:1",
        status: "queued",
        changedAt: "2026-04-07T12:00:00.000Z",
      },
    });
    publisher.publishQueueMovement({
      actorUserIdentityId: "user-1",
      workspaceId: "workspace-a",
      payload: {
        queueItemId: "runtime-queue:run:1",
        executionId: "run:1",
        status: "queued",
        changedAt: "2026-04-07T12:00:00.000Z",
      },
    });

    expect(published.run).toHaveLength(1);
    expect(published.queue).toHaveLength(1);
  });
});
