import { describe, expect, it } from "bun:test";
import { InlineRunActionResolver, InlineRunLaunchService } from "../InlineRunActions";
import { UxRunActionKinds } from "../../runtime/UxRuntimeService";

describe("InlineRunActionResolver", () => {
  it("resolves run/test actions for runnable explore/detail assets", () => {
    const resolver = new InlineRunActionResolver();
    const actions = resolver.resolveForAsset({
      source: "explore",
      asset: {
        assetId: "asset:workflow:1",
        versionId: "asset:workflow:1:v1",
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "workflow",
          behaviorKind: "deterministic",
        },
      },
    });

    expect(actions.map((entry) => entry.label)).toEqual(["Run here", "Test here"]);
    expect(actions.every((entry) => entry.enabled)).toBe(true);
  });

  it("disables run/test actions for non-runnable assets", () => {
    const resolver = new InlineRunActionResolver();
    const actions = resolver.resolveForAsset({
      source: "explore",
      asset: {
        assetId: "asset:dataset:1",
        versionId: "asset:dataset:1:v1",
        taxonomy: {
          structuralKind: "atomic",
          semanticRole: "dataset",
          behaviorKind: "none",
        },
      },
    });

    expect(actions.every((entry) => entry.enabled === false)).toBe(true);
  });
});

describe("InlineRunLaunchService", () => {
  it("preserves source context in run launch path", () => {
    const service = new InlineRunLaunchService();
    const result = service.launch({
      action: UxRunActionKinds.test,
      target: { kind: "asset", assetId: "asset:workflow:1", versionId: "asset:workflow:1:v1" },
      context: {
        source: "explore",
        registryContextQuery: "q=workflow",
        originPath: "/explore",
        originLabel: "Explore",
      },
    });

    expect(result.launchPath).toContain("/run?");
    expect(result.launchPath).toContain("action=test");
    expect(result.launchPath).toContain("source=explore");
    expect(result.launchPath).toContain("originPath=%2Fexplore");
    expect(result.launchPath).toContain("registryContext=q%3Dworkflow");
  });
});
