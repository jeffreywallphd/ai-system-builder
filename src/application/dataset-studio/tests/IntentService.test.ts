import { describe, expect, it } from "bun:test";
import { IntentService } from "../IntentService";
import { TemplateService } from "../TemplateService";

describe("IntentService", () => {
  it("lists default intents", () => {
    const service = new IntentService(new TemplateService());
    expect(service.listIntents().map((intent) => intent.id)).toEqual([
      "analytics",
      "document",
      "ml",
    ]);
  });

  it("resolves document intent with extraction and chunking stage requirements", () => {
    const service = new IntentService(new TemplateService());
    const resolution = service.resolve({
      intentId: "document",
    });

    expect(resolution.intent.id).toBe("document");
    expect(resolution.intent.templateId).toBe("document-default");
    const kinds = resolution.stageFlow.stages.map((stage) => stage.kind);
    expect(kinds).toContain("extraction");
    expect(kinds).toContain("chunking");
    expect(resolution.defaultStageConfiguration.extraction?.includeLayoutMetadata).toBeTrue();
  });

  it("merges template and intent defaults while inserting ML feature engineering stage", () => {
    const service = new IntentService(new TemplateService());
    const resolution = service.resolve({
      intentId: "ml",
      stageConfigurationOverrides: Object.freeze({
        normalization: Object.freeze({ schemaMode: "known", useDetectedSchema: false }),
      }),
    });

    expect(resolution.intent.templateId).toBe("elt-default");
    expect(resolution.stageFlow.stages.some((stage) => stage.kind === "feature-engineering")).toBeTrue();
    expect(resolution.defaultStageConfiguration.transformation?.strategy).toBe("set-based");
    expect(resolution.defaultStageConfiguration.normalization?.schemaMode).toBe("known");
    expect(resolution.defaultStageConfiguration.normalization?.useDetectedSchema).toBeFalse();
  });
});
