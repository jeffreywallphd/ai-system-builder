import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDesktopAgentRuntimeProvider } from "../runtime/DesktopAgentRuntimeProvider";

describe("desktop agent runtime provider", () => {
  it("memoizes AgentStudioBackendApi and rebuilds after dispose", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-runtime-provider-"));
    const storagePaths = {
      appDataDirectory: tmpRoot,
      storageDirectory: path.join(tmpRoot, "storage"),
      databasePath: path.join(tmpRoot, "storage", "ai-loom-studio.sqlite"),
      runtimeDirectory: path.join(tmpRoot, "runtime"),
      logsDirectory: path.join(tmpRoot, "logs"),
      assetsDirectory: path.join(tmpRoot, "assets"),
      modelsDirectory: path.join(tmpRoot, "models"),
    };
    fs.mkdirSync(path.join(storagePaths.storageDirectory, "agents"), { recursive: true });
    fs.mkdirSync(storagePaths.assetsDirectory, { recursive: true });

    const provider = createDesktopAgentRuntimeProvider({ storagePaths });
    const first = provider.ensureAgentStudioBackendApi();
    const second = provider.ensureAgentStudioBackendApi();
    expect(second).toBe(first);

    provider.dispose();
    const third = provider.ensureAgentStudioBackendApi();
    expect(third).not.toBe(first);

    provider.dispose();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });
});
