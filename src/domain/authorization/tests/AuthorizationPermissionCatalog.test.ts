import { describe, expect, it } from "bun:test";
import {
  AuthorizationPermissionActionMatrix,
  AuthorizationPermissionCatalog,
  AuthorizationResourceFamilies,
  createCatalogPermissionKey,
  getCatalogActionsForResourceFamily,
  isCatalogPermissionKey,
} from "../AuthorizationPermissionCatalog";

describe("AuthorizationPermissionCatalog", () => {
  it("exposes deterministic keys from the canonical action matrix", () => {
    expect(AuthorizationPermissionCatalog.keys).toEqual([
      "asset.read",
      "asset.create",
      "asset.update",
      "asset.delete",
      "asset.share",
      "asset.publish",
      "asset.unpublish",
      "asset.manage",
      "system.read",
      "system.create",
      "system.update",
      "system.delete",
      "system.share",
      "system.execute",
      "system.publish",
      "system.unpublish",
      "system.manage",
      "workflow.read",
      "workflow.create",
      "workflow.update",
      "workflow.delete",
      "workflow.share",
      "workflow.run",
      "workflow.cancel",
      "workflow.manage",
      "template.read",
      "template.create",
      "template.update",
      "template.delete",
      "template.share",
      "template.instantiate",
      "template.publish",
      "template.unpublish",
      "template.manage",
      "run.read",
      "run.list",
      "run.cancel",
      "run.retry",
      "run.delete",
      "run.manage",
      "queue.read",
      "queue.enqueue",
      "queue.dequeue",
      "queue.cancel",
      "queue.manage",
      "log.read",
      "log.list",
      "log.export",
      "log.redact",
      "log.delete",
      "log.manage",
      "storage-instance.read",
      "storage-instance.create",
      "storage-instance.update",
      "storage-instance.delete",
      "storage-instance.mount",
      "storage-instance.unmount",
      "storage-instance.manage",
      "secret-metadata.read",
      "secret-metadata.list",
      "secret-metadata.create",
      "secret-metadata.update",
      "secret-metadata.delete",
      "secret-metadata.share",
      "secret-metadata.manage",
      "artifact.read",
      "artifact.create",
      "artifact.update",
      "artifact.delete",
      "artifact.share",
      "artifact.publish",
      "artifact.unpublish",
      "artifact.manage",
    ]);
  });

  it("keeps key entries unique across all families/actions", () => {
    expect(new Set(AuthorizationPermissionCatalog.keys).size).toBe(
      AuthorizationPermissionCatalog.keys.length,
    );
    expect(AuthorizationPermissionCatalog.keySet.size).toBe(
      AuthorizationPermissionCatalog.keys.length,
    );
  });

  it("maps each family/action pair to one stable key", () => {
    for (const [resourceFamily, actions] of Object.entries(AuthorizationPermissionActionMatrix)) {
      for (const action of actions) {
        const key = AuthorizationPermissionCatalog.resources[resourceFamily][action];
        expect(key).toBe(`${resourceFamily}.${action}`);
        expect(AuthorizationPermissionCatalog.keySet.has(key)).toBeTrue();
      }
    }
  });

  it("creates keys from helpers without permission literals in consumers", () => {
    expect(createCatalogPermissionKey("workflow", "run")).toBe("workflow.run");
    expect(createCatalogPermissionKey("asset", "publish")).toBe("asset.publish");
    expect(
      getCatalogActionsForResourceFamily(AuthorizationResourceFamilies.template),
    ).toEqual(["read", "create", "update", "delete", "share", "instantiate", "publish", "unpublish", "manage"]);
  });

  it("identifies whether arbitrary strings are catalog permissions", () => {
    expect(isCatalogPermissionKey("run.retry")).toBeTrue();
    expect(isCatalogPermissionKey("workflow.execute")).toBeFalse();
    expect(isCatalogPermissionKey("random.value")).toBeFalse();
  });
});
