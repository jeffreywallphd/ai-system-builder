import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("deferred feature IPC registration organization", () => {
  it("keeps main-process deferred registration as orchestration only", () => {
    const mainSource = read("electron/main/main.ts");
    expect(mainSource).toContain("registerDeferredFeatureIpcDomains({");
    expect(mainSource).toContain("registerDeferredFeatureIpc(() => {");
    expect(mainSource).not.toContain("ipcMain.on(\"ai-loom-desktop-workflows:save-record\"");
    expect(mainSource).not.toContain("ipcMain.handle(\"ai-loom-desktop-canonical-assets:list\"");
  });

  it("keeps expected domain registration modules and key channels", () => {
    const files = [
      ["electron/main/ipc/registerWorkflowPersistenceIpc.ts", "ai-loom-desktop-workflows:save-record"],
      ["electron/main/ipc/registerExecutionRunIpc.ts", "ai-loom-desktop-execution-runs:list"],
      ["electron/main/ipc/registerWorkflowRunHistoryIpc.ts", "ai-loom-desktop-workflow-runs:list"],
      ["electron/main/ipc/registerAgentStudioIpc.ts", "ai-loom-desktop-agents:create"],
      ["electron/main/ipc/registerStudioShellIpc.ts", "ai-loom-desktop-studio-shell:initialize"],
      ["electron/main/ipc/registerSystemStudioIpc.ts", "ai-loom-desktop-studio-shell:system-components:list"],
      ["electron/main/ipc/registerSystemRuntimeIpc.ts", "ai-loom-desktop-studio-shell:runtime-window:launch"],
      ["electron/main/ipc/registerModelFileIpc.ts", "ai-loom-desktop-model-files:read"],
      ["electron/main/ipc/registerCanonicalRegistryIpc.ts", "ai-loom-desktop-registry:assets"],
    ] as const;

    for (const [filePath, channel] of files) {
      const source = read(filePath);
      expect(source).toContain(channel);
    }
  });
});
