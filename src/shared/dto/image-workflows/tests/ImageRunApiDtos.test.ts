import { describe, expect, it } from "bun:test";
import {
  toCancelImageRunResponseDto,
  toListImageRunEventsResponseDto,
  toSubmitImageRunResponseDto,
} from "../ImageRunApiDtos";

describe("ImageRunApiDtos", () => {
  it("projects immutable submit-run response DTOs", () => {
    const response = toSubmitImageRunResponseDto({
      contractVersion: "image-run-api/v1",
      run: {
        runId: "run:image:1",
        workspaceId: "workspace:alpha",
        systemId: "system:portrait-restyle",
        workflowId: "wf:image:restyle",
        state: "running",
        source: "api",
        submittedAt: "2026-04-08T16:00:00.000Z",
        updatedAt: "2026-04-08T16:00:10.000Z",
      },
      mutation: {
        changed: true,
        mutationId: "mutation:run:1",
        occurredAt: "2026-04-08T16:00:10.000Z",
      },
    });

    expect(Object.isFrozen(response)).toBeTrue();
    expect(response.run.runId).toBe("run:image:1");
  });

  it("projects immutable cancel-run response DTOs", () => {
    const response = toCancelImageRunResponseDto({
      contractVersion: "image-run-api/v1",
      run: {
        runId: "run:image:1",
        workspaceId: "workspace:alpha",
        systemId: "system:portrait-restyle",
        workflowId: "wf:image:restyle",
        state: "cancelling",
        source: "ui-manual",
        submittedAt: "2026-04-08T16:00:00.000Z",
        updatedAt: "2026-04-08T16:00:20.000Z",
      },
      mutation: {
        changed: true,
      },
    });

    expect(Object.isFrozen(response)).toBeTrue();
    expect(response.run.state).toBe("cancelling");
  });

  it("projects immutable run-event list DTOs", () => {
    const response = toListImageRunEventsResponseDto({
      contractVersion: "image-run-api/v1",
      items: [{
        eventId: "event:1",
        contractVersion: "image-run-api/v1",
        category: "lifecycle",
        eventKind: "state-changed",
        runId: "run:image:1",
        workspaceId: "workspace:alpha",
        systemId: "system:portrait-restyle",
        occurredAt: "2026-04-08T16:00:30.000Z",
        sequence: 5,
        cursor: "image-run-event:5",
        payload: {
          previousState: "queued",
          state: "running",
        },
      }],
      nextCursor: "image-run-event:5",
    });

    expect(Object.isFrozen(response)).toBeTrue();
    expect(response.items).toHaveLength(1);
    expect(response.items[0]?.eventKind).toBe("state-changed");
  });
});

