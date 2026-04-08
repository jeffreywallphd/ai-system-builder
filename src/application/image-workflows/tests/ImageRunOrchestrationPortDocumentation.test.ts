import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const docPath = path.join(repoRoot, "docs", "architecture", "image-run-orchestration-application-ports.md");
const aiDocPath = path.join(repoRoot, "docs", "architecture", "image-run-orchestration-application-ports.ai.md");

describe("image run orchestration application-port documentation", () => {
  it("keeps human and AI companion docs checked in", () => {
    expect(existsSync(docPath)).toBeTrue();
    expect(existsSync(aiDocPath)).toBeTrue();
  });

  it("documents repository and orchestration boundaries for authoritative image runs", () => {
    const doc = readFileSync(docPath, "utf8");

    expect(doc).toContain("Run persistence repository");
    expect(doc).toContain("Execution-state persistence repository");
    expect(doc).toContain("Readiness resolution");
    expect(doc).toContain("Queue orchestration");
    expect(doc).toContain("Execution handoff");
    expect(doc).toContain("Execution update ingestion");
    expect(doc).toContain("Cancellation orchestration");
    expect(doc).toContain("Output handoff notification");
    expect(doc).toContain("scheduling/node-assignment logic can evolve");
  });
});

