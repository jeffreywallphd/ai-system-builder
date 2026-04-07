import { describe, expect, it } from "bun:test";
import { BuildIntents } from "../BuildIntentModels";
import { BuildFlowContextService } from "../BuildFlowState";
import { BuildIntentRoutingService } from "../BuildIntentRouting";

describe("Build flow state model", () => {
  it("captures intent, target, and contextual launch data on routed session start", () => {
    const selection = {
      intent: BuildIntents.automateTask,
      selectedAtIso: "2026-03-28T00:00:00.000Z",
    } as const;
    const decision = new BuildIntentRoutingService().decideRoute({ selection });
    const service = new BuildFlowContextService();

    const session = service.startSessionFromRouteDecision(selection, decision);

    expect(session.selection.intent).toBe(BuildIntents.automateTask);
    expect(session.current.flowTarget).toBe(decision.target);
    expect(session.current.launchContext.intent?.key).toBe(BuildIntents.automateTask);
    expect(session.current.progress).toBe("active");
    expect(session.transitions.length).toBe(1);
  });

  it("preserves related assets and coherent transitions through inline and resume steps", () => {
    const selection = {
      intent: BuildIntents.workWithData,
      selectedAtIso: "2026-03-28T00:00:00.000Z",
    } as const;
    const decision = new BuildIntentRoutingService().decideRoute({ selection });
    const service = new BuildFlowContextService();

    const started = service.startSessionFromRouteDecision(selection, decision);
    const withAsset = service.linkAsset(started.sessionId, {
      assetId: "asset:dataset:1",
      versionId: "asset:dataset:1:v1",
      relation: "created",
    });
    const paused = service.setResumeContext(started.sessionId, {
      returnTarget: { routePath: "/build", contextId: "build-flow" },
    });
    const resumed = service.resumeSession(started.sessionId, "/studio-shell/dataset-pipeline");

    expect(withAsset?.current.relatedAssets).toHaveLength(1);
    expect(withAsset?.current.relatedAssets[0]?.assetId).toBe("asset:dataset:1");
    expect(paused?.current.progress).toBe("paused");
    expect(resumed?.current.progress).toBe("active");
    expect(resumed?.current.resumeContext?.resumePath).toBe("/studio-shell/dataset-pipeline");
    expect(resumed?.transitions.map((entry) => entry.kind)).toEqual([
      "intent-routed",
      "asset-linked",
      "mode-changed",
      "resumed",
    ]);
  });
});
