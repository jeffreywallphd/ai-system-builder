import { describe, expect, it } from "bun:test";
import path from "node:path";
import {
  createAuthoritativePersistenceMigrationHooks,
  createAuthoritativePersistentPlatformServices,
} from "../AuthoritativePersistenceComposition";

describe("AuthoritativePersistenceComposition", () => {
  it("builds deterministic migration hooks for all authoritative persistence domains", () => {
    const hooks = createAuthoritativePersistenceMigrationHooks();
    const ids = hooks.map((hook) => hook.migrationId);
    const uniqueIds = new Set(ids);

    expect(ids.length).toBeGreaterThan(0);
    expect(uniqueIds.size).toBe(ids.length);
    expect(ids).toContain("identity:v1");
    expect(ids).toContain("workspaces:v1");
    expect(ids).toContain("authorization:v1");
    expect(ids).toContain("nodes:v1");
    expect(ids).toContain("storage:v1");
    expect(ids).toContain("assets:v1");
    expect(ids).toContain("asset-upload-sessions:v1");
    expect(ids).toContain("platform:v1");
    expect(ids).toContain("certificate-authority:v1");
    expect(ids).toContain("secret-records:v1");
  });

  it("creates and disposes authoritative persistent platform services", () => {
    const services = createAuthoritativePersistentPlatformServices({
      databasePath: path.join("runtime-assets", "server", "authoritative-composition-test.sqlite"),
    });

    expect(services.databasePath.endsWith("authoritative-composition-test.sqlite")).toBeTrue();
    expect(services.identityRepository).toBeDefined();
    expect(services.workspaceRepository).toBeDefined();
    expect(services.platformPersistenceRepository).toBeDefined();

    expect(() => services.dispose()).not.toThrow();
  });
});
