import { describe, expect, it } from "bun:test";
import { buildStorageAdministrationPath } from "../StorageAdministrationRoutes";

describe("StorageAdministrationRoutes", () => {
  it("builds encoded storage administration paths", () => {
    expect(buildStorageAdministrationPath({
      workspaceId: "workspace:1",
      storageInstanceId: "storage:images:1",
    })).toBe("/settings/storage?workspaceId=workspace%3A1&storageInstanceId=storage%3Aimages%3A1");

    expect(buildStorageAdministrationPath({
      workspaceId: "workspace:2",
    })).toBe("/settings/storage?workspaceId=workspace%3A2");
  });
});
