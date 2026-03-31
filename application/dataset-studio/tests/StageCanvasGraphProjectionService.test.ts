import { describe, expect, it } from "bun:test";
import { IntentService } from "../IntentService";
import {
  StageCanvasGraphProjectionService,
} from "../StageCanvasGraphProjectionService";
import { TemplateService } from "../TemplateService";
import { WizardFlowEngine } from "../WizardFlowEngine";

describe("StageCanvasGraphProjectionService", () => {
  it("projects stage flow into stage groups, nodes, and edges with metadata", () => {
    const templateService = new TemplateService();
    const template = templateService.getTemplate("elt-default");
    const engine = new WizardFlowEngine({ template });
    engine.setStageConfiguration("source", Object.freeze({ sourceKind: "json" }));
    engine.goNext();

    const service = new StageCanvasGraphProjectionService();
    const graph = service.projectFromWizard(engine);

    expect(graph.flowId).toBe(template.stageFlow.flowId);
    expect(graph.groups.length).toBe(template.stageFlow.stages.length);
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);

    const currentGroup = graph.groups.find((group) => group.stageId === engine.getState().currentStageId);
    expect(currentGroup?.status).toBe("current");
    expect(currentGroup?.metadata.summary.executionMode).toBeDefined();

    const sourceGroup = graph.groups.find((group) => group.stageId === "source");
    expect(sourceGroup?.metadata.configuration.sourceKind).toBe("json");
    expect(sourceGroup?.metadata.inspection?.stageId).toBe("source");

    const sourceNodes = graph.nodes.filter((node) => node.stageId === "source");
    expect(sourceNodes.length).toBeGreaterThan(0);
    expect(sourceNodes[0]?.groupId).toBe(sourceGroup?.id);
    expect(sourceNodes[0]?.metadata.inspectionStatus).toBe(sourceGroup?.metadata.inspection?.status);
  });

  it("projects template-instantiated and saved flows", () => {
    const templateService = new TemplateService();
    const instance = templateService.instantiate(Object.freeze({
      templateId: "document-default",
      skippedStageIds: Object.freeze(["extraction"]),
    }));

    const service = new StageCanvasGraphProjectionService();
    const templateGraph = service.projectFromTemplateInstance(instance);
    expect(templateGraph.source).toBe("template");
    expect(templateGraph.metadata.stageCount).toBe(instance.stageFlow.stages.length);

    const savedGraph = service.projectFromSavedFlow({
      stageFlow: instance.stageFlow,
      state: instance.state,
    });
    expect(savedGraph.source).toBe("saved");
    expect(savedGraph.metadata.stageCount).toBe(templateGraph.metadata.stageCount);
  });

  it("preserves intent/template influenced stage ordering in projection", () => {
    const templateService = new TemplateService();
    const intentService = new IntentService(templateService);
    const engine = new WizardFlowEngine({
      intentId: "ml",
      intentService,
    });

    const service = new StageCanvasGraphProjectionService();
    const graph = service.projectFromWizard(engine);

    const flowOrder = engine.getStageFlow().stages.map((stage) => stage.id);
    const graphOrder = [...graph.groups]
      .sort((left, right) => left.metadata.stageOrder - right.metadata.stageOrder)
      .map((group) => group.stageId);

    expect(graphOrder).toEqual(flowOrder);
    expect(graph.groups.some((group) => group.stageId === "feature-engineering")).toBeTrue();
  });
});
