import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const baselineMdPath = resolve(
  repoRoot,
  "docs/baselines/architecture/runtime-host-surfaces/desktop-control-plane-host-promotion-baseline-1.1.1.md",
);
const baselineAiPath = resolve(
  repoRoot,
  "docs/baselines/architecture/runtime-host-surfaces/desktop-control-plane-host-promotion-baseline-1.1.1.ai.md",
);

function assertPromotionBaselineCoverage(source: string): void {
  expect(source).toContain("electron/main/main.ts");
  expect(source).toContain("electron/main/runtime/PostLoginRuntimeBootstrapper.ts");
  expect(source).toContain("src/hosts/server/AuthMinimalServerHostEntrypoint.ts");
  expect(source).toContain("src/hosts/server/AuthoritativeServerHostEntrypoint.ts");
  expect(source).toContain("await previousRuntime.stop();");
  expect(source).toContain("startAuthoritativeServerHostAssembly(...)");
  expect(source).toContain("connection-refused");
  expect(source).toContain("renderer-facing control-plane socket binds once and remains available for the full desktop session");
  expect(source).toContain("No production runtime behavior changed.");
}

describe("desktop control-plane host promotion baseline story 1.1.1 guardrails", () => {
  it("adds paired baseline documents for human and AI readers", () => {
    expect(existsSync(baselineMdPath)).toBe(true);
    expect(existsSync(baselineAiPath)).toBe(true);
  });

  it("captures the current stop-and-start promotion behavior and persistent-host invariants", () => {
    const baselineMd = readFileSync(baselineMdPath, "utf8");
    const baselineAi = readFileSync(baselineAiPath, "utf8");

    assertPromotionBaselineCoverage(baselineMd);
    assertPromotionBaselineCoverage(baselineAi);
  });
});
