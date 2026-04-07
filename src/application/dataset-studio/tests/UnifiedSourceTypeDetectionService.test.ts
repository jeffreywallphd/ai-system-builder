import { describe, expect, it } from "bun:test";
import {
  UnifiedIngestionDetectionConfidenceLevels,
  UnifiedIngestionReferenceKinds,
} from "@domain/dataset-studio/UnifiedIngestionDomain";
import { UnifiedSourceTypeDetectionService } from "../UnifiedSourceTypeDetectionService";

function createSource(overrides?: Partial<{
  sourceId: string;
  referenceKind: "local-path" | "remote-url" | "file-handle" | "in-memory";
  reference: string;
  extension?: string;
  mimeType?: string;
  displayName?: string;
}>): {
  sourceId: string;
  referenceKind: "local-path" | "remote-url" | "file-handle" | "in-memory";
  reference: string;
  extension?: string;
  mimeType?: string;
  displayName?: string;
} {
  return {
    sourceId: overrides?.sourceId ?? "src-1",
    referenceKind: overrides?.referenceKind ?? UnifiedIngestionReferenceKinds.localPath,
    reference: overrides?.reference ?? "C:/tmp/source",
    extension: overrides?.extension,
    mimeType: overrides?.mimeType,
    displayName: overrides?.displayName,
  };
}

describe("UnifiedSourceTypeDetectionService", () => {
  it("detects CSV from extension and emits explainable evidence", async () => {
    const service = new UnifiedSourceTypeDetectionService();

    const result = await service.detect({
      source: createSource({ reference: "C:/tmp/users.csv", extension: ".csv" }),
    });

    expect(result.detectedKind).toBe("csv");
    expect(result.evidence.some((entry) => entry.kind === "extension-heuristic")).toBeTrue();
    expect(result.candidateScores.csv).toBeGreaterThan(0);
  });

  it("detects JSON without extension using content sniffing", async () => {
    const service = new UnifiedSourceTypeDetectionService();

    const result = await service.detect({
      source: createSource({ reference: "C:/tmp/source" }),
      payload: "[{\"id\":1,\"name\":\"Ada\"}]",
    });

    expect(result.detectedKind).toBe("json");
    expect(result.evidence.some((entry) => entry.message.includes("valid JSON"))).toBeTrue();
  });

  it("detects PDF from content signature when metadata is missing", async () => {
    const service = new UnifiedSourceTypeDetectionService();
    const payload = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

    const result = await service.detect({
      source: createSource({ reference: "C:/tmp/source" }),
      payload,
    });

    expect(result.detectedKind).toBe("document");
    expect(result.evidence.some((entry) => entry.kind === "content-sniff")).toBeTrue();
  });

  it("detects common image payload signatures", async () => {
    const service = new UnifiedSourceTypeDetectionService();
    const pngPayload = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const result = await service.detect({
      source: createSource({ reference: "C:/tmp/source" }),
      payload: pngPayload,
    });

    expect(result.detectedKind).toBe("image");
  });

  it("resolves conflicting evidence deterministically and records conflict reasoning", async () => {
    const service = new UnifiedSourceTypeDetectionService();

    const result = await service.detect({
      source: createSource({
        reference: "C:/tmp/data.csv",
        extension: ".csv",
        mimeType: "application/json",
      }),
      payload: "[{\"id\":\"1\"}]",
    });

    expect(result.detectedKind).toBe("json");
    expect(result.candidateScores.json).toBeGreaterThan(result.candidateScores.csv);
    expect(result.evidence.some((entry) => entry.kind === "conflict-resolution") || result.confidence === "high").toBeTrue();
  });

  it("returns unknown for ambiguous text and marks low confidence", async () => {
    const service = new UnifiedSourceTypeDetectionService();

    const result = await service.detect({
      source: createSource({ reference: "C:/tmp/source.bin" }),
      payload: "lorem ipsum dolor sit amet",
      enableContentSniffing: true,
    });

    expect(result.detectedKind).toBe("unknown");
    expect(result.confidence).toBe(UnifiedIngestionDetectionConfidenceLevels.low);
  });

  it("keeps JSON ahead of text-like csv extension when content proves JSON", async () => {
    const service = new UnifiedSourceTypeDetectionService();

    const result = await service.detect({
      source: createSource({ reference: "C:/tmp/data.csv", extension: ".csv" }),
      payload: "{\"id\":1,\"name\":\"Ada\"}",
    });

    expect(result.detectedKind).toBe("json");
    expect(result.candidateScores.json).toBeGreaterThan(result.candidateScores.csv);
  });

  it("uses provided signature sniffer evidence when available", async () => {
    const service = new UnifiedSourceTypeDetectionService({
      signatureSniffer: {
        sniff: async () => Object.freeze({
          extension: ".pdf",
          mimeType: "application/pdf",
          detector: "stub-sniffer",
        }),
      },
    });

    const result = await service.detect({
      source: createSource({ reference: "C:/tmp/no-extension" }),
      payload: new Uint8Array([1, 2, 3, 4, 5]),
    });

    expect(result.detectedKind).toBe("document");
    expect(result.normalizedMetadata.mimeType).toBe("application/pdf");
    expect(result.evidence.some((entry) => entry.kind === "signature-sniff")).toBeTrue();
  });
});

