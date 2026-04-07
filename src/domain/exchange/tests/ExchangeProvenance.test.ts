import { describe, expect, it } from "bun:test";
import { ExchangeProvenanceTracker } from "../ExchangeProvenance";

describe("ExchangeProvenanceTracker", () => {
  it("records export provenance and import lineage edges", () => {
    const tracker = new ExchangeProvenanceTracker();
    const exported = tracker.createExportProvenance({
      bundleId: "exchange:atomic:asset:a:asset:a:v1",
      subjectKind: "atomic-asset",
      exportedAssetId: "asset:a",
      exportedVersionId: "asset:a:v1",
      exportedAt: "2026-03-28T00:00:00.000Z",
    });

    const imported = tracker.createImportProvenance({
      bundleId: "exchange:atomic:asset:a:asset:a:v1",
      sourceAssetId: "asset:a",
      sourceVersionId: "asset:a:v1",
      importedAssetId: "asset:a",
      importedVersionId: "asset:a:v1",
      importedAt: "2026-03-28T01:00:00.000Z",
      decision: "reuse-existing",
      remappedDependencyVersionIds: {},
    });

    const edge = tracker.createImportEdge({
      sourceVersionId: imported.sourceVersionId,
      targetVersionId: imported.importedVersionId,
      decision: imported.decision,
      bundleId: imported.bundleId,
      createdAt: imported.importedAt,
    });

    const record = tracker.createRecord({ exportProvenance: exported, importProvenance: imported, lineageEdges: [edge] });

    expect(record.exportProvenance?.bundleId).toBe("exchange:atomic:asset:a:asset:a:v1");
    expect(record.importProvenance?.decision).toBe("reuse-existing");
    expect(record.lineageEdges[0]?.kind).toBe("reused-from-bundle");
  });
});
