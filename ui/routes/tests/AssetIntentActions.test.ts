import { describe, expect, it } from "bun:test";
import {
  AssetActionExecutionService,
  AssetIntentActionResolver,
  AssetIntentActionTypes,
  type AssetActionContext,
} from "../AssetIntentActions";

function makeContext(overrides: Partial<AssetActionContext> = {}): AssetActionContext {
  return {
    source: "detail",
    asset: {
      assetId: "asset:workflow:1",
      versionId: "asset:workflow:1:v1",
      taxonomy: {
        structuralKind: "composite",
        semanticRole: "workflow",
        behaviorKind: "deterministic",
      },
    },
    registryContextQuery: "keyword=demo",
    buildFlowSessionId: "build-flow-1",
    buildIntent: "automate-task",
    buildIntentSelectedAt: "2026-03-28T00:00:00.000Z",
    ...overrides,
  };
}

describe("AssetIntentActionResolver", () => {
  it("returns intent-aware actions with contextual availability", () => {
    const resolver = new AssetIntentActionResolver();
    const workflowActions = resolver.resolveActions(makeContext());
    const systemActions = resolver.resolveActions(makeContext({
      asset: {
        assetId: "asset:system:1",
        versionId: "asset:system:1:v1",
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        },
      },
    }));

    expect(workflowActions.map((entry) => entry.label)).toEqual([
      "Build from this",
      "Open and modify",
      "Add to system",
      "Run here",
      "Test here",
      "Extend / connect",
    ]);
    expect(workflowActions.find((entry) => entry.type === AssetIntentActionTypes.runHere)?.enabled).toBe(true);
    expect(workflowActions.find((entry) => entry.type === AssetIntentActionTypes.testHere)?.enabled).toBe(true);
    expect(systemActions.find((entry) => entry.type === AssetIntentActionTypes.addToSystem)?.enabled).toBe(false);
  });
});

describe("AssetActionExecutionService", () => {
  it("maps actions to studio-entry launch routes and preserves build-flow context", () => {
    const service = new AssetActionExecutionService();
    const open = service.execute(AssetIntentActionTypes.openAndModify, makeContext());
    const build = service.execute(AssetIntentActionTypes.buildFromThis, makeContext());
    const run = service.execute(AssetIntentActionTypes.runHere, makeContext());
    const test = service.execute(AssetIntentActionTypes.testHere, makeContext());

    expect(open?.launchPath).toContain("assetId=asset%3Aworkflow%3A1");
    expect(open?.launchPath).toContain("entryMode=asset");
    expect(open?.launchPath).toContain("buildFlowSessionId=build-flow-1");
    expect(build?.launchPath).toContain("buildIntent=automate-task");
    expect(build?.launchPath).toContain("buildIntentSelectedAt=");
    expect(build?.studioEntry?.initializationPayload.initialization.context.intent?.key).toBe("automate-task");
    expect(run?.launchPath).toContain("/run?");
    expect(run?.launchPath).toContain("context=asset");
    expect(run?.launchPath).toContain("intent=Run+here");
    expect(test?.launchPath).toContain("intent=Test+here");
    expect(test?.launchPath).toContain("action=test");
  });

  it("uses inline creation flow for extend/connect on system assets", () => {
    const service = new AssetActionExecutionService();
    const result = service.execute(AssetIntentActionTypes.extendOrConnect, makeContext({
      asset: {
        assetId: "asset:system:1",
        versionId: "asset:system:1:v1",
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        },
      },
    }));

    expect(result?.launchPath).toContain("inlineCreate=1");
    expect(result?.launchPath).toContain("inlineMode=system-intake");
    expect(result?.launchPath).toContain("returnTo=%2Fregistry%2Fasset%253Asystem%253A1");
  });
});
