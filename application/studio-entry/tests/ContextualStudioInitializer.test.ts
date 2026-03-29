import { describe, expect, it } from "bun:test";
import { createStudioHandoffContract, StudioHandoffIntentKinds } from "../../../domain/studio-handoff/StudioHandoffContract";
import { ContextualStudioInitializer } from "../ContextualStudioInitializer";
import { StudioEntryModes } from "../StudioEntryContracts";

describe("ContextualStudioInitializer", () => {
  const initializer = new ContextualStudioInitializer();

  it("creates blank/new initialization payloads without authoritative asset facts", () => {
    const blank = initializer.createInitialization("model-studio", {});
    expect(blank.initialization.mode).toBe(StudioEntryModes.blank);
    expect(blank.initialization.context.authoritativeAsset).toBeUndefined();

    const fresh = initializer.createInitialization("workflow-studio", { mode: StudioEntryModes.new, prefill: { values: { title: "Draft" } } });
    expect(fresh.initialization.mode).toBe(StudioEntryModes.new);
    expect(fresh.initialization.context.prefill?.values).toEqual({ title: "Draft" });
  });

  it("preserves authoritative asset identity separately from prefill hints", () => {
    const payload = initializer.createInitialization("tool-studio", {
      mode: StudioEntryModes.asset,
      asset: {
        assetId: "asset:tool",
        versionId: "asset:tool:v3",
        taxonomy: { structuralKind: "atomic", semanticRole: "tool", behaviorKind: "deterministic" },
      },
      prefill: { values: { title: "Suggested title", category: "mcp" } },
    });

    expect(payload.initialization.context.authoritativeAsset).toEqual({
      assetId: "asset:tool",
      versionId: "asset:tool:v3",
      taxonomy: { structuralKind: "atomic", semanticRole: "tool", behaviorKind: "deterministic" },
    });
    expect(payload.initialization.context.prefill?.values).toEqual({ title: "Suggested title", category: "mcp" });
  });

  it("supports handoff-driven initialization including system studio payloads", () => {
    const handoff = createStudioHandoffContract({
      id: "handoff:system",
      source: { studioType: "workflow-studio", studioId: "studio-workflows" },
      target: { studioType: "system-studio", studioId: "studio-systems" },
      payload: {
        assetId: "asset:system",
        versionId: "asset:system:v1",
        taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
        targetInputContract: { contractId: "contract:system", acceptedStructuralKinds: ["system"] },
      },
      intent: {
        kind: StudioHandoffIntentKinds.systemIntegration,
        description: "Open System Studio from cross-studio handoff",
      },
    });

    const payload = initializer.createInitialization("system-studio", { handoff, prefill: { values: { selectedComponent: "child-a" } } });
    expect(payload.initialization.mode).toBe(StudioEntryModes.handoff);
    expect(payload.initialization.context.handoff?.handoff.id.value).toBe("handoff:system");
    expect(payload.initialization.context.authoritativeAsset).toEqual({
      assetId: "asset:system",
      versionId: "asset:system:v1",
      taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
    });
    expect(payload.initialization.context.prefill?.values).toEqual({ selectedComponent: "child-a" });
  });
});
