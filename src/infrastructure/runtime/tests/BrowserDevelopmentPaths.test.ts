import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { BROWSER_DEVELOPMENT_REPOSITORY_ROOT } from "../browser-development/BrowserDevelopmentPaths";

describe("BrowserDevelopmentPaths", () => {
  it("resolves the repository root used by browser development runtime bootstrapping", () => {
    const packageJsonPath = path.join(BROWSER_DEVELOPMENT_REPOSITORY_ROOT, "package.json");
    const supervisorEntrypointPath = path.join(
      BROWSER_DEVELOPMENT_REPOSITORY_ROOT,
      "src",
      "infrastructure",
      "runtime",
      "service-supervisor.js",
    );

    expect(existsSync(packageJsonPath)).toBeTrue();
    expect(existsSync(supervisorEntrypointPath)).toBeTrue();
  });
});
