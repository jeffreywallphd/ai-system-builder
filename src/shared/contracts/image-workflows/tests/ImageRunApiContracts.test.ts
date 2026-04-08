import { describe, expect, it } from "bun:test";
import {
  buildImageRunEventCursor,
  parseImageRunEventCursor,
  toListImageRunEventsQueryParams,
  toListImageRunsQueryParams,
} from "../ImageRunApiContracts";

describe("ImageRunApiContracts", () => {
  it("serializes list-runs query params with repeated filter values", () => {
    const query = toListImageRunsQueryParams({
      contractVersion: "image-run-api/v1",
      workspaceId: "workspace:alpha",
      systemId: "system:portrait-restyle",
      states: ["queued", "running"],
      sources: ["api", "ui-manual"],
      search: "portrait",
      limit: 25,
      offset: 10,
      sortBy: "updatedAt",
      sortDirection: "desc",
    });

    expect(query.get("workspaceId")).toBe("workspace:alpha");
    expect(query.get("systemId")).toBe("system:portrait-restyle");
    expect(query.getAll("state")).toEqual(["queued", "running"]);
    expect(query.getAll("source")).toEqual(["api", "ui-manual"]);
    expect(query.get("sortBy")).toBe("updatedAt");
    expect(query.get("sortDirection")).toBe("desc");
  });

  it("serializes list-run-events query params", () => {
    const query = toListImageRunEventsQueryParams({
      contractVersion: "image-run-api/v1",
      workspaceId: "workspace:alpha",
      runId: "run:image:1",
      afterCursor: "image-run-event:4",
      limit: 50,
    });

    expect(query.get("workspaceId")).toBe("workspace:alpha");
    expect(query.get("runId")).toBe("run:image:1");
    expect(query.get("afterCursor")).toBe("image-run-event:4");
    expect(query.get("limit")).toBe("50");
  });

  it("builds and parses canonical run-event cursors", () => {
    const cursor = buildImageRunEventCursor(7.9);
    expect(cursor).toBe("image-run-event:7");
    expect(parseImageRunEventCursor(cursor)).toBe(7);
    expect(parseImageRunEventCursor("image-run-event:not-a-number")).toBeUndefined();
  });
});

