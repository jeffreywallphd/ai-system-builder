import { describe, expect, expectTypeOf, it } from "../../../testing/node-test";

import {
  RUNTIME_INSTALL_TARGET_COMFYUI,
  type RuntimeInstallRequest,
  type RuntimeInstallResult,
  type RuntimeInstallSource,
  type RuntimeInstallStatus,
  type RuntimeInstallStatusResult,
} from "..";

describe("runtime installer contracts", () => {
  it("defines install status literals", () => {
    const statuses: RuntimeInstallStatus[] = [
      "not-installed",
      "installing",
      "installed",
      "update-available",
      "failed",
      "unknown",
    ];

    expect(statuses).toContain("installed");
    expect(statuses).toContain("update-available");
  });

  it("defines install request/result/status shapes", () => {
    const source: RuntimeInstallSource = {
      type: "git",
      repositoryUrl: "https://github.com/comfyanonymous/ComfyUI.git",
      ref: "master",
    };

    const request: RuntimeInstallRequest = {
      targetId: RUNTIME_INSTALL_TARGET_COMFYUI,
      installRoot: "/tmp/runtime/comfyui",
      source,
      allowUpdate: true,
      metadata: {
        initiatedBy: "desktop-host",
      },
    };

    const result: RuntimeInstallResult = {
      targetId: request.targetId,
      status: "installed",
      installRoot: request.installRoot,
      source: request.source,
      requestedRef: "master",
      resolvedRef: "origin/master",
      commitSha: "abc123",
      installedAt: "2026-04-30T00:00:00.000Z",
      lastCheckedAt: "2026-04-30T00:01:00.000Z",
      warnings: [],
    };

    const statusResult: RuntimeInstallStatusResult = {
      targetId: request.targetId,
      status: "installed",
      installRoot: request.installRoot,
      source: request.source,
      requestedRef: "master",
      resolvedRef: "origin/master",
      commitSha: "abc123",
      installedAt: result.installedAt,
      lastCheckedAt: result.lastCheckedAt,
    };

    expect(request.targetId).toBe("comfyui");
    expect(result.status).toBe("installed");
    expect(statusResult.commitSha).toBe("abc123");
  });

  it("allows forward-compatible unknown source types", () => {
    const source: RuntimeInstallSource = {
      type: "archive",
      archiveUrl: "https://example.test/runtime.tar.gz",
    };

    expect(source.type).toBe("archive");
  });
});
