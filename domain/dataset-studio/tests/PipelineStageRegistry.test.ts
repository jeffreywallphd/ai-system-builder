import { describe, expect, it } from "bun:test";
import { PipelineStageIds } from "../PipelineStageDomain";
import { PipelineStageRegistry } from "../PipelineStageRegistry";

describe("PipelineStageRegistry", () => {
  it("registers the full Epic 17 stage set", () => {
    const registry = new PipelineStageRegistry();
    const definitions = registry.listDefinitions();

    expect(definitions).toHaveLength(15);
    expect(registry.has(PipelineStageIds.SourceSelection)).toBeTrue();
    expect(registry.has(PipelineStageIds.StoragePrepared)).toBeTrue();
  });

  it("supports runtime inspectability of stage definitions", () => {
    const registry = new PipelineStageRegistry();
    const inspectable = registry.inspect();

    expect(inspectable[PipelineStageIds.Cleaning]?.displayName).toBe("Cleaning");
    expect(inspectable[PipelineStageIds.Cleaning]?.orderingConstraints.after).toContain(PipelineStageIds.Normalization);
  });

  it("exposes strongly typed stage definitions", () => {
    const registry = new PipelineStageRegistry();
    const extraction = registry.getDefinition(PipelineStageIds.Extraction);

    expect(extraction.supportsPreview).toBeTrue();
    expect(extraction.orderingConstraints.before).toContain(PipelineStageIds.Chunking);
  });
});