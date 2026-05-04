import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "../../../../modules/testing/node-test";

describe("server dev runner", () => {
  it("keeps the server workspace dev script on the repository dev runner", () => {
    const packageJson = JSON.parse(
      readFileSync(path.resolve("apps/server/package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.dev).toBe("node ../../dev-tools/scripts/server/dev-server.mjs");
  });

  it("uses in-process TypeScript watch plus the emitted CommonJS server instead of a subprocess watcher", () => {
    const source = readFileSync(
      path.resolve("dev-tools/scripts/server/dev-server.mjs"),
      "utf8",
    );

    expect(source).toContain("ts.createWatchCompilerHost");
    expect(source).toContain("ts.createWatchProgram");
    expect(source).toContain("dist\", \"apps\", \"server\", \"src\", \"createServer.js");
    expect(source).not.toContain("node:child_process");
    expect(source).not.toContain("tsx watch");
    expect(source).not.toContain("esbuild");
  });
});
