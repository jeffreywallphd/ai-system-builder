import { describe, expect, it } from "bun:test";
import { BuildIntents } from "../BuildIntentModels";
import {
  BuildIntentFlowTargets,
  BuildIntentRoutingReasons,
  BuildIntentRoutingService,
} from "../BuildIntentRouting";
import { ROUTE_PATHS } from "../RouteConfig";

describe("BuildIntentRoutingService", () => {
  const routingService = new BuildIntentRoutingService();
  const selectedAtIso = "2026-03-28T00:00:00.000Z";

  it("maps representative intents to deterministic internal flow targets", () => {
    const cases = [
      { intent: BuildIntents.automateTask, target: BuildIntentFlowTargets.workflowAutomation, route: ROUTE_PATHS.workflowStudio },
      { intent: BuildIntents.createAssistant, target: BuildIntentFlowTargets.assistantAuthoring, route: ROUTE_PATHS.agentStudio },
      { intent: BuildIntents.trainModel, target: BuildIntentFlowTargets.modelTraining, route: ROUTE_PATHS.trainingRecipeStudio },
      { intent: BuildIntents.workWithData, target: BuildIntentFlowTargets.dataPreparation, route: ROUTE_PATHS.datasetPipelineStudio },
      { intent: BuildIntents.startFromScratch, target: BuildIntentFlowTargets.compositionBlankCanvas, route: ROUTE_PATHS.systemStudio },
    ] as const;

    for (const entry of cases) {
      const decision = routingService.decideRoute({ selection: { intent: entry.intent, selectedAtIso } });
      expect(decision.target).toBe(entry.target);
      expect(decision.launchPath).toContain(entry.route);
      expect(decision.studioEntry.initializationPayload.initialization.mode).toBe("intent");
      expect(decision.studioEntryRequest.intent?.key).toBe(entry.intent);
    }
  });

  it("keeps start-from-scratch intent-safe and non-taxonomy-first", () => {
    const decision = routingService.decideRoute({ selection: { intent: BuildIntents.startFromScratch, selectedAtIso } });

    expect(decision.routingReason).toBe(BuildIntentRoutingReasons.intentSafeBlankCompositionFlow);
    expect(decision.launchCategory).toBe("blank");
    expect(decision.studioEntryRequest.requestedStudioType).toBe("system-studio");
    expect(decision.studioEntryRequest.requestedRole).toBeUndefined();
  });

  it("routes composition-oriented intent into system studio when appropriate", () => {
    const decision = routingService.decideRoute({ selection: { intent: BuildIntents.startFromScratch, selectedAtIso } });

    expect(decision.studioEntry.entryPoint.routePath).toBe(ROUTE_PATHS.systemStudio);
    expect(decision.target).toBe(BuildIntentFlowTargets.compositionBlankCanvas);
  });

  it("carries provided prefill values through intent routing context", () => {
    const decision = routingService.decideRoute({
      selection: { intent: BuildIntents.automateTask, selectedAtIso },
      prefill: { automationIntent: "Draft weekly KPI summary workflow." },
    });

    expect(decision.studioEntryRequest.prefill?.values).toEqual({ automationIntent: "Draft weekly KPI summary workflow." });
    expect(decision.studioEntry.initializationPayload.initialization.context.prefill?.values).toEqual({
      automationIntent: "Draft weekly KPI summary workflow.",
    });
  });
});
