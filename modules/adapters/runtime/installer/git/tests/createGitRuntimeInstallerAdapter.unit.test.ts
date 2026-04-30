import { describe, expect, it, testDouble } from "../../../../../testing/node-test";

import { createGitRuntimeInstallerAdapter } from "../createGitRuntimeInstallerAdapter";

const baseRequest = {
  targetId: "runtime-a",
  installRoot: "/runtime/root",
  source: { type: "git" as const, repositoryUrl: "https://example.com/repo.git", ref: "main" },
};

function createFsMocks({ existingRoot = false, emptyRoot = false, metadata }: { existingRoot?: boolean; emptyRoot?: boolean; metadata?: unknown } = {}) {
  const stat = testDouble.fn(async (targetPath: string) => {
    if (targetPath === baseRequest.installRoot && existingRoot) {
      return {} as never;
    }
    if (targetPath.endsWith(".ai-system-builder-runtime-install.json") && metadata !== undefined) {
      return {} as never;
    }
    throw new Error("enoent");
  });
  const readdir = testDouble.fn(async () => (emptyRoot ? [] : ["file"]));
  const readFile = testDouble.fn(async () => JSON.stringify(metadata));
  const writeFile = testDouble.fn(async () => undefined);
  const mkdir = testDouble.fn(async () => undefined);
  return { stat, readdir, readFile, writeFile, mkdir };
}

describe("createGitRuntimeInstallerAdapter", () => {
  it("status returns not-installed when root missing", async () => {
    const fs = createFsMocks();
    const adapter = createGitRuntimeInstallerAdapter({ ...fs });
    const result = await adapter.getInstallStatus(baseRequest);
    expect(result.status).toBe("not-installed");
  });

  it("status returns installed from valid metadata", async () => {
    const now = "2026-01-01T00:00:00.000Z";
    const fs = createFsMocks({
      existingRoot: true,
      metadata: {
        managedBy: "ai-system-builder",
        targetId: baseRequest.targetId,
        installRoot: baseRequest.installRoot,
        source: baseRequest.source,
        installedAt: now,
        lastCheckedAt: now,
      },
    });
    const adapter = createGitRuntimeInstallerAdapter({ ...fs });
    const result = await adapter.getInstallStatus(baseRequest);
    expect(result.status).toBe("installed");
  });

  it("status rejects unmanaged non-empty directory", async () => {
    const fs = createFsMocks({ existingRoot: true, metadata: { managedBy: "other" } });
    const adapter = createGitRuntimeInstallerAdapter({ ...fs });
    const result = await adapter.getInstallStatus(baseRequest);
    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("unmanaged-install-root");
  });

  it("ensureInstalled clones git repo", async () => {
    const fs = createFsMocks();
    const execFile = testDouble.fn(async (_file: string, args: readonly string[] = []) => {
      if (args.includes("rev-parse")) return { stdout: "abc123\n", stderr: "" };
      return { stdout: "", stderr: "" };
    });
    const adapter = createGitRuntimeInstallerAdapter({ ...fs, execFile, now: () => "2026-01-01T00:00:00.000Z" });
    const result = await adapter.ensureInstalled(baseRequest);
    expect(result.status).toBe("installed");
    expect(execFile).toHaveBeenCalledWith("git", ["clone", baseRequest.source.repositoryUrl, baseRequest.installRoot]);
  });

  it("ensureInstalled checks out ref when provided", async () => {
    const fs = createFsMocks();
    const execFile = testDouble.fn(async (_file: string, args: readonly string[] = []) => ({ stdout: args.includes("rev-parse") ? "abc\n" : "", stderr: "" }));
    const adapter = createGitRuntimeInstallerAdapter({ ...fs, execFile, now: () => "2026-01-01T00:00:00.000Z" });
    await adapter.ensureInstalled(baseRequest);
    expect(execFile).toHaveBeenCalledWith("git", ["-C", baseRequest.installRoot, "checkout", "main"]);
  });

  it("ensureInstalled writes metadata", async () => {
    const fs = createFsMocks();
    const execFile = testDouble.fn(async (_file: string, args: readonly string[] = []) => ({ stdout: args.includes("rev-parse") ? "abc\n" : "", stderr: "" }));
    const adapter = createGitRuntimeInstallerAdapter({ ...fs, execFile, now: () => "2026-01-01T00:00:00.000Z" });
    await adapter.ensureInstalled(baseRequest);
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it("ensureInstalled returns existing installed metadata without clone", async () => {
    const fs = createFsMocks({
      existingRoot: true,
      metadata: {
        managedBy: "ai-system-builder",
        targetId: baseRequest.targetId,
        installRoot: baseRequest.installRoot,
        source: baseRequest.source,
        installedAt: "2026-01-01T00:00:00.000Z",
        lastCheckedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    const execFile = testDouble.fn();
    const adapter = createGitRuntimeInstallerAdapter({ ...fs, execFile });
    const result = await adapter.ensureInstalled(baseRequest);
    expect(result.status).toBe("installed");
    expect(execFile).not.toHaveBeenCalled();
  });

  it("allowUpdate runs fetch/pull for managed install", async () => {
    const fs = createFsMocks({
      existingRoot: true,
      metadata: {
        managedBy: "ai-system-builder",
        targetId: baseRequest.targetId,
        installRoot: baseRequest.installRoot,
        source: baseRequest.source,
        installedAt: "2026-01-01T00:00:00.000Z",
        lastCheckedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    const execFile = testDouble.fn(async (_file: string, args: readonly string[] = []) => ({ stdout: args.includes("rev-parse") ? "abc\n" : "", stderr: "" }));
    const adapter = createGitRuntimeInstallerAdapter({ ...fs, execFile, now: () => "2026-01-02T00:00:00.000Z" });
    await adapter.ensureInstalled({ ...baseRequest, allowUpdate: true });
    expect(execFile).toHaveBeenCalledWith("git", ["-C", baseRequest.installRoot, "fetch", "--all", "--tags"]);
    expect(execFile).toHaveBeenCalledWith("git", ["-C", baseRequest.installRoot, "pull", "--ff-only"]);
  });

  it("unsupported source fails", async () => {
    const fs = createFsMocks();
    const adapter = createGitRuntimeInstallerAdapter({ ...fs });
    const result = await adapter.ensureInstalled({ ...baseRequest, source: { type: "archive" } as never });
    expect(result.error?.code).toBe("unsupported-install-source");
  });

  it("missing repositoryUrl fails", async () => {
    const fs = createFsMocks();
    const adapter = createGitRuntimeInstallerAdapter({ ...fs });
    const result = await adapter.ensureInstalled({ ...baseRequest, source: { type: "git", repositoryUrl: "" } });
    expect(result.error?.code).toBe("missing-repository-url");
  });

  it("unmanaged root is not modified", async () => {
    const fs = createFsMocks({ existingRoot: true, metadata: { managedBy: "other" } });
    const execFile = testDouble.fn();
    const adapter = createGitRuntimeInstallerAdapter({ ...fs, execFile });
    const result = await adapter.ensureInstalled(baseRequest);
    expect(result.error?.code).toBe("unmanaged-install-root");
    expect(execFile).not.toHaveBeenCalled();
  });

  it("repairInstall fails for unmanaged install", async () => {
    const fs = createFsMocks({ existingRoot: true, metadata: { managedBy: "other" } });
    const adapter = createGitRuntimeInstallerAdapter({ ...fs });
    const result = await adapter.repairInstall!(baseRequest);
    expect(result.status).toBe("failed");
  });

  it("Git failures map to clear error codes", async () => {
    const fs = createFsMocks();
    const execFile = testDouble.fn(async (_file: string, args: readonly string[] = []) => {
      if (args[0] === "clone") throw new Error("clone failed");
      return { stdout: "", stderr: "" };
    });
    const adapter = createGitRuntimeInstallerAdapter({ ...fs, execFile });
    const result = await adapter.ensureInstalled(baseRequest);
    expect(result.error?.code).toBe("git-clone-failed");
  });
});
