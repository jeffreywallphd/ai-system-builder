/// <reference types="node" />
import { describe, expect, it } from "bun:test";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import {
  BatchIngestionFramework,
  BatchIngestionItemErrorCodes,
  BatchIngestorKinds,
  BatchIngestionStrategyKinds,
} from "../BatchIngestionFramework";
import {
  SourceDescriptorKinds,
  SourceInputKinds,
} from "../SourceLocatorInputAbstraction";

async function createBatchFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "batch-ingestion-test-"));
  await fs.writeFile(path.join(root, "users.csv"), "Name,Score\nAda,10\nLin,8", "utf-8");
  await fs.writeFile(path.join(root, "users-2.csv"), "Name,Score\nTao,9", "utf-8");
  await fs.writeFile(path.join(root, "users.json"), JSON.stringify([{ id: "1", name: "Ada" }]), "utf-8");
  await fs.writeFile(path.join(root, "users-2.json"), JSON.stringify([{ id: "2", name: "Lin" }]), "utf-8");
  return root;
}

describe("BatchIngestionFramework", () => {
  it("ingests multiple sources successfully and aggregates canonical outputs", async () => {
    const fixture = await createBatchFixture();
    const framework = new BatchIngestionFramework();

    const result = await framework.executeBatch({
      sourceRequest: {
        input: {
          kind: SourceInputKinds.localDirectory,
          path: fixture,
        },
        config: {
          supportedExtensions: [".csv", ".json"],
        },
      },
      strategy: { kind: BatchIngestionStrategyKinds.routed },
    });

    expect(result.failureCount).toBe(0);
    expect(result.successCount).toBe(4);
    expect(result.outputs.length).toBe(4);
    expect(result.outputs.every((entry) => entry.output.kind === "records")).toBeTrue();
    expect(result.preview.shapeSummary.records).toBe(4);
    expect(result.logging.batch.asset.assetId).toBe("batch-ingestion-framework");
    expect(result.lineage.producer.assetId).toBe("batch-ingestion-framework");
  });

  it("supports partial failures while continuing other items when continueOnError is true", async () => {
    const fixture = await createBatchFixture();
    const framework = new BatchIngestionFramework();

    const result = await framework.executeBatch({
      sourceRequest: {
        input: {
          kind: SourceInputKinds.localFiles,
          paths: [
            path.join(fixture, "users.csv"),
            path.join(fixture, "missing.csv"),
            path.join(fixture, "users.json"),
          ],
        },
      },
      strategy: { kind: BatchIngestionStrategyKinds.routed },
      config: {
        continueOnError: true,
      },
    });

    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBeGreaterThan(0);
    expect(result.items.some((item) => !item.ok && item.error.code === BatchIngestionItemErrorCodes.unreadableFile)).toBeTrue();
    expect(result.items.some((item) => !item.ok && item.normalizedIssue?.category === "unreadable-source")).toBeTrue();
    expect(result.warnings.some((issue) => issue.code === "batch-partial-failure")).toBeTrue();
    expect(result.logging.batch.status).toBe("partial");
  });

  it("supports fail-fast behavior when continueOnError is false", async () => {
    const fixture = await createBatchFixture();
    const framework = new BatchIngestionFramework();

    const result = await framework.executeBatch({
      descriptors: Object.freeze([
        Object.freeze({
          sourceId: "remote-1",
          kind: SourceDescriptorKinds.remoteFile,
          originalReference: "https://example.com/users.csv",
          normalizedReference: "https://example.com/users.csv",
          sourceType: "file" as const,
          displayName: "users.csv",
          extension: ".csv",
        }),
        Object.freeze({
          sourceId: "local-1",
          kind: SourceDescriptorKinds.localFile,
          originalReference: path.join(fixture, "users.csv"),
          normalizedReference: path.join(fixture, "users.csv"),
          sourceType: "file" as const,
          displayName: "users.csv",
          extension: ".csv",
        }),
      ]),
      strategy: { kind: BatchIngestionStrategyKinds.selected, ingestor: BatchIngestorKinds.csv },
      config: {
        continueOnError: false,
      },
    });

    expect(result.items[0]?.ok).toBeFalse();
    expect(result.items[1]?.ok).toBeFalse();
    if (result.items[1] && !result.items[1].ok) {
      expect(result.items[1].error.code).toBe(BatchIngestionItemErrorCodes.failFastStopped);
    }
    expect(result.logging.items.length).toBe(2);
  });

  it("applies shared ingestor configuration across batch items", async () => {
    const fixture = await createBatchFixture();
    const framework = new BatchIngestionFramework();

    const result = await framework.executeBatch({
      sourceRequest: {
        input: {
          kind: SourceInputKinds.localDirectory,
          path: fixture,
          patterns: ["*.csv"],
        },
      },
      strategy: { kind: BatchIngestionStrategyKinds.selected, ingestor: BatchIngestorKinds.csv },
      sharedConfig: {
        csv: {
          normalizeHeadersToLowercase: true,
          header: true,
        },
      },
    });

    expect(result.failureCount).toBe(0);
    const firstOutput = result.outputs[0]?.output;
    expect(firstOutput?.kind).toBe("records");
    if (firstOutput?.kind === "records") {
      expect("name" in firstOutput.records[0].fields).toBeTrue();
      expect("score" in firstOutput.records[0].fields).toBeTrue();
    }
  });

  it("returns bounded preview payloads using previewItemLimit", async () => {
    const fixture = await createBatchFixture();
    const framework = new BatchIngestionFramework();

    const result = await framework.previewBatch({
      sourceRequest: {
        input: {
          kind: SourceInputKinds.localDirectory,
          path: fixture,
        },
        config: {
          supportedExtensions: [".csv", ".json"],
        },
      },
      config: {
        previewItemLimit: 2,
      },
    });

    expect(result.preview.previewedCount).toBe(2);
    expect(result.preview.truncated).toBeFalse();
    expect(result.itemCount).toBe(2);
    expect(result.preview.normalized.ingestor).toBe("batch-ingestion-framework");
    expect(result.preview.normalized.summary.sampleCount).toBe(2);
    expect(result.preview.normalized.log.preview).toBeTrue();
    expect(result.logging.batch.preview).toBeTrue();
  });

  it("routes missing-extension descriptors using content detection", async () => {
    const fixture = await createBatchFixture();
    const framework = new BatchIngestionFramework();

    const result = await framework.executeBatch({
      descriptors: Object.freeze([
        Object.freeze({
          sourceId: "no-ext-json",
          kind: SourceDescriptorKinds.localFile,
          originalReference: path.join(fixture, "users.json"),
          normalizedReference: path.join(fixture, "users.json"),
          sourceType: "file" as const,
          displayName: "users-data",
        }),
      ]),
      strategy: { kind: BatchIngestionStrategyKinds.routed },
    });

    expect(result.failureCount).toBe(0);
    expect(result.successCount).toBe(1);
    expect(result.outputs[0]?.ingestor).toBe(BatchIngestorKinds.json);
  });

  it("prefers JSON content over csv-like extension in routed mode", async () => {
    const fixture = await createBatchFixture();
    const aliasPath = path.join(fixture, "json-with-csv-extension.csv");
    await fs.writeFile(aliasPath, JSON.stringify([{ id: "x-1", name: "Ada" }]), "utf-8");
    const framework = new BatchIngestionFramework();

    const result = await framework.executeBatch({
      sourceRequest: {
        input: {
          kind: SourceInputKinds.localFile,
          path: aliasPath,
        },
      },
      strategy: { kind: BatchIngestionStrategyKinds.routed },
    });

    expect(result.failureCount).toBe(0);
    expect(result.outputs[0]?.ingestor).toBe(BatchIngestorKinds.json);
  });
});
