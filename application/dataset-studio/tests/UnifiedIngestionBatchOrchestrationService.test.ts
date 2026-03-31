/// <reference types="node" />
import { describe, expect, it } from "bun:test";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { SourceInputKinds } from "../SourceLocatorInputAbstraction";
import { UnifiedIngestionBatchOrchestrationService } from "../UnifiedIngestionBatchOrchestrationService";
import { UnifiedIngestionOutputTargetKinds } from "../../../domain/dataset-studio/UnifiedIngestionDomain";

async function createFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "unified-ingestion-batch-"));
  await fs.writeFile(path.join(root, "users.csv"), "id,name\n1,Ada\n2,Lin", "utf-8");
  await fs.writeFile(path.join(root, "users.json"), JSON.stringify([{ id: "3", name: "Tao" }]), "utf-8");
  return root;
}

describe("UnifiedIngestionBatchOrchestrationService", () => {
  it("supports mixed-format batch preview through unified per-item orchestration", async () => {
    const fixture = await createFixture();
    const service = new UnifiedIngestionBatchOrchestrationService();

    const result = await service.previewBatch({
      sourceRequest: {
        input: {
          kind: SourceInputKinds.localDirectory,
          path: fixture,
          patterns: ["*.csv", "*.json"],
        },
      },
      configuration: {
        mode: "simple",
        outputTarget: UnifiedIngestionOutputTargetKinds.records,
      },
      options: {
        continueOnError: true,
      },
    });

    expect(result.summary.totalItems).toBe(2);
    expect(result.summary.succeeded).toBe(2);
    expect(result.summary.failed).toBe(0);
    expect(result.items.every((item) => item.status === "succeeded")).toBeTrue();
    expect(result.items.every((item) => item.preview?.model)).toBeTrue();
    expect(result.normalizedOutputs.length).toBe(2);
    expect(result.summary.sourceKindDistribution.csv).toBe(1);
    expect(result.summary.sourceKindDistribution.json).toBe(1);
  });

  it("reports partial success for mixed success/failure batches", async () => {
    const fixture = await createFixture();
    const service = new UnifiedIngestionBatchOrchestrationService();

    const result = await service.previewBatch({
      sourceRequest: {
        input: {
          kind: SourceInputKinds.localFiles,
          paths: [path.join(fixture, "users.csv"), path.join(fixture, "missing.csv")],
        },
      },
      configuration: {
        mode: "simple",
        outputTarget: UnifiedIngestionOutputTargetKinds.records,
      },
      options: {
        continueOnError: true,
      },
    });

    expect(result.summary.succeeded).toBe(1);
    expect(result.summary.failed).toBe(1);
    expect(result.summary.partialSuccess).toBeTrue();
    expect(result.issues.some((issue) => issue.code === "batch-partial-failure")).toBeTrue();
  });

  it("skips remaining items under fail-fast policy", async () => {
    const fixture = await createFixture();
    const service = new UnifiedIngestionBatchOrchestrationService();

    const result = await service.previewBatch({
      sourceRequest: {
        input: {
          kind: SourceInputKinds.localFiles,
          paths: [path.join(fixture, "missing.csv"), path.join(fixture, "users.csv")],
        },
      },
      configuration: {
        mode: "simple",
        outputTarget: UnifiedIngestionOutputTargetKinds.records,
      },
      options: {
        continueOnError: false,
      },
    });

    expect(result.summary.failed).toBe(1);
    expect(result.summary.skipped).toBe(1);
    expect(result.items.some((item) => item.status === "skipped")).toBeTrue();
    expect(result.issues.some((issue) => issue.code === "batch-item-skipped")).toBeTrue();
  });

  it("returns a structured invalid-batch result for empty source input", async () => {
    const service = new UnifiedIngestionBatchOrchestrationService();

    const result = await service.previewBatch({
      configuration: {
        mode: "simple",
        outputTarget: UnifiedIngestionOutputTargetKinds.records,
      },
    });

    expect(result.summary.empty).toBeTrue();
    expect(result.summary.totalItems).toBe(0);
    expect(result.issues[0]?.code).toBe("invalid-batch-input");
  });
});
