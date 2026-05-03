import path from "node:path";

import { describe, expect, it } from "../../../../modules/testing/node-test";
import { readFileSync } from "node:fs";

import {
  DEFAULT_SERVER_PORT,
  DEFAULT_SERVER_RUNTIME_ROOT_DIRECTORY_NAME,
  DEFAULT_SERVER_STORAGE_ROOT_DIRECTORY_NAME,
  resolveDefaultServerRuntimeRootDirectory,
  resolveDefaultServerStorageRootDirectory,
  resolveServerRuntimeConfig
} from "../createServer";

describe("resolveServerRuntimeConfig", () => {
  it("uses stable server-owned defaults when environment overrides are absent in CJS runtime", () => {
    const config = resolveServerRuntimeConfig({});
    expect(config.port).toBe(DEFAULT_SERVER_PORT);
    expect(config.storageRootDirectory).toBe(
path.resolve("apps", "server", DEFAULT_SERVER_STORAGE_ROOT_DIRECTORY_NAME),
    );
    expect(config.runtimeRootDirectory).toBe(
path.resolve("apps", "server", DEFAULT_SERVER_RUNTIME_ROOT_DIRECTORY_NAME),
    );
    expect(config.runtimeRootDirectory).not.toContain(config.storageRootDirectory);
  });

  it("honors SERVER_STORAGE_ROOT override when provided without moving runtime root", () => {
    const config = resolveServerRuntimeConfig({
      SERVER_STORAGE_ROOT: " ./tmp/server-root ",
    });

    expect(config.storageRootDirectory).toBe(path.resolve("./tmp/server-root"));
    expect(config.runtimeRootDirectory).toBe(resolveDefaultServerRuntimeRootDirectory());
  });

  it("honors SERVER_RUNTIME_ROOT override when provided", () => {
    const config = resolveServerRuntimeConfig({
      SERVER_RUNTIME_ROOT: " ./tmp/server-runtime ",
    });

    expect(config.runtimeRootDirectory).toBe(path.resolve("./tmp/server-runtime"));
  });

  it("exposes stable default storage/runtime roots in CJS runtime", () => {
    expect(resolveDefaultServerStorageRootDirectory()).toBe(
path.resolve("apps", "server", DEFAULT_SERVER_STORAGE_ROOT_DIRECTORY_NAME),
    );
    expect(resolveDefaultServerRuntimeRootDirectory()).toBe(
path.resolve("apps", "server", DEFAULT_SERVER_RUNTIME_ROOT_DIRECTORY_NAME),
    );
  });

  it("createServer passes runtime root to registerApi", () => {
    const source = readFileSync(path.resolve("apps/server/src/createServer.ts"), "utf8");
    expect(source).toContain("runtimeRootDirectory: config.runtimeRootDirectory");
    expect(source).toContain("storageRootDirectory: config.storageRootDirectory");
  });

  it("index startup log includes runtime root", () => {
    const source = readFileSync(path.resolve("apps/server/src/index.ts"), "utf8");
    expect(source).toContain("runtime root:");
    expect(source).toContain("config.runtimeRootDirectory");
  });
});
