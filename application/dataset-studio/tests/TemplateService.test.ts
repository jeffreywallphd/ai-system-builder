import { describe, expect, it } from "bun:test";
import { TemplateService } from "../TemplateService";

describe("TemplateService", () => {
  it("lists default templates with UI-ready stage metadata", () => {
    const service = new TemplateService();
    const templates = service.listTemplates();

    expect(templates.map((template) => template.id)).toEqual([
      "elt-default",
      "document-default",
      "analytics-default",
    ]);
    expect(templates[0]?.stages[0]?.stageId).toBe("source");
  });

  it("instantiates templates with partial customization", () => {
    const service = new TemplateService();
    const instance = service.instantiate({
      templateId: "analytics-default",
      orderedStageIds: Object.freeze([
        "source",
        "ingestion",
        "cleaning",
        "profiling",
        "aggregation",
        "prepared-storage",
      ]),
      skippedStageIds: Object.freeze(["profiling"]),
      stageConfigurationOverrides: Object.freeze({
        aggregation: Object.freeze({ grain: "weekly" }),
      }),
    });

    expect(instance.stageFlow.stages.map((stage) => stage.id)).toEqual([
      "source",
      "ingestion",
      "cleaning",
      "profiling",
      "aggregation",
      "prepared-storage",
    ]);
    expect(instance.state.skippedStageIds).toContain("profiling");
    expect(instance.state.stageConfiguration.aggregation?.grain).toBe("weekly");
  });

  it("fails validation when a template references an unmapped stage kind", () => {
    const service = new TemplateService();
    const template = service.getTemplate("elt-default");

    const invalid = Object.freeze({
      ...template,
      id: "invalid-template",
      stageFlow: Object.freeze({
        ...template.stageFlow,
        stages: Object.freeze(template.stageFlow.stages.map((stage, index) => (
          index === 0
            ? Object.freeze({ ...stage, kind: "non-existent-stage-kind" as never })
            : stage
        ))),
      }),
    });

    expect(() => service.validateTemplate(invalid)).toThrow("no valid stage-to-asset mapping");
  });
});
