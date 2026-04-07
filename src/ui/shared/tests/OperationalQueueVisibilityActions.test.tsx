import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createSurfaceActionContext,
  invokeSurfaceAction,
  resolveSurfaceActionDescriptors,
} from "../actions";
import {
  OperationalQueueVisibilityPanel,
  QueueVisibilityScopes,
  createOperationalQueueRowActions,
  createOperationalQueueRowModels,
} from "../operations";
import { createSurfaceResponsiveProfile } from "../responsive";

describe("Operational queue visibility and action flows", () => {
  it("renders queue filters and priority/order fields across responsive table cards", () => {
    const html = renderToStaticMarkup(
      React.createElement(OperationalQueueVisibilityPanel, {
        queueItems: Object.freeze([
          Object.freeze({
            queueItemId: "queue:running",
            executionId: "run:2",
            systemId: "system:beta",
            status: "running",
            enqueuedAt: "2026-04-07T12:01:00.000Z",
            startedAt: "2026-04-07T12:02:00.000Z",
            priority: 50,
          }),
          Object.freeze({
            queueItemId: "queue:queued",
            executionId: "run:1",
            systemId: "system:alpha",
            status: "queued",
            enqueuedAt: "2026-04-07T12:00:00.000Z",
            priority: 100,
          }),
        ]),
        totalCount: 2,
        selectedQueueItemId: "queue:queued",
        filters: Object.freeze({
          visibilityScope: QueueVisibilityScopes.active,
          systemIdFilter: "",
          queryFilter: "",
        }),
        isLoading: false,
        responsiveProfile: createSurfaceResponsiveProfile({ viewportWidthPx: 420 }),
        actorPermissionIds: Object.freeze(["runtime.queue.refresh", "runtime.run.inspect", "runtime.run.cancel", "runtime.queue.manage"]),
        surface: "thin-client",
        onFiltersChanged: () => undefined,
        onRefreshQueue: () => undefined,
        onInspectRun: () => undefined,
        onCancelRun: () => undefined,
        onDequeue: () => undefined,
        onSelectQueueItem: () => undefined,
      }),
    );

    expect(html).toContain("Queue visibility");
    expect(html).toContain("Visibility");
    expect(html).toContain("Priority");
    expect(html).toContain("Order");
    expect(html).toContain("data-label=\"Execution\"");
    expect(html).toContain("Visible queue items: 2");
  });

  it("enforces permission and queue-state guards while invoking shared queue row actions", async () => {
    const [row] = createOperationalQueueRowModels(Object.freeze([
      Object.freeze({
        queueItemId: "queue:running",
        executionId: "run:running",
        systemId: "system:alpha",
        status: "running",
        enqueuedAt: "2026-04-07T12:00:00.000Z",
        priority: 1,
      }),
    ]));
    let inspectCalled = 0;
    let cancelCalled = 0;
    let dequeueCalled = 0;
    const descriptors = createOperationalQueueRowActions({
      row,
      onInspectRun: () => { inspectCalled += 1; },
      onCancelRun: () => { cancelCalled += 1; },
      onDequeue: () => { dequeueCalled += 1; },
    });
    const context = createSurfaceActionContext({
      actorPermissionIds: Object.freeze(["runtime.run.inspect", "runtime.run.cancel", "runtime.queue.manage"]),
      surface: "desktop",
      surfaceCapabilities: Object.freeze(["menu-actions", "inline-actions"]),
      resource: row,
    });

    const resolved = resolveSurfaceActionDescriptors(descriptors, context);
    const inspectAction = resolved.find((action) => action.label === "Inspect run");
    const cancelAction = resolved.find((action) => action.label === "Cancel run");
    const dequeueAction = resolved.find((action) => action.label === "Dequeue");

    expect(inspectAction?.visibility).toBe("visible");
    expect(cancelAction?.visibility).toBe("visible");
    expect(dequeueAction?.visibility).toBe("disabled");

    await invokeSurfaceAction(inspectAction!, context);
    await invokeSurfaceAction(cancelAction!, context);
    const dequeueResult = await invokeSurfaceAction(dequeueAction!, context);

    expect(inspectCalled).toBe(1);
    expect(cancelCalled).toBe(1);
    expect(dequeueCalled).toBe(0);
    expect(dequeueResult.invoked).toBe(false);
  });
});
