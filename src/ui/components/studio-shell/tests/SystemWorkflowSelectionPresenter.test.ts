import { describe, expect, it } from "bun:test";
import type {
  StudioImageSystemDefinitionSummaryReadModel,
  StudioImageWorkflowDefinitionSummaryReadModel,
} from "@infrastructure/api/studio-shell/StudioShellBackendApi";
import {
  presentSavedImageSystemOptions,
  presentSupportedEditTypeOptions,
} from "../SystemWorkflowSelectionPresenter";

const workflowSummaries: ReadonlyArray<StudioImageWorkflowDefinitionSummaryReadModel> = Object.freeze([Object.freeze({
  workflowId: "image-template:image-to-image-restyle:v1",
  title: "Restyle from image",
  summary: "Prompt-driven variation from a source image.",
  operationKind: "image-to-image",
  version: Object.freeze({
    lineageId: "image-template:image-to-image-restyle",
    versionTag: "v1",
    revision: 1,
  }),
  updatedAt: "2026-04-08T00:00:00.000Z",
}), Object.freeze({
  workflowId: "image-template:enhance-upscale:v1",
  title: "Enhance and upscale",
  summary: "Increase clarity and resolution for one image.",
  operationKind: "enhance-upscale",
  version: Object.freeze({
    lineageId: "image-template:enhance-upscale",
    versionTag: "v1",
    revision: 1,
  }),
  updatedAt: "2026-04-08T00:00:00.000Z",
})]);

const savedSystems: ReadonlyArray<StudioImageSystemDefinitionSummaryReadModel> = Object.freeze([Object.freeze({
  systemId: "system:restyle",
  title: "Portrait restyle",
  summary: "Softer portrait look",
  lifecycleState: "active",
  runtimeStatus: "ready",
  workflowId: "image-template:image-to-image-restyle:v1",
  workflowVersionTag: "v1",
  readinessState: "ready",
  readinessSummary: "Ready to launch",
  readiness: Object.freeze({
    state: "configuration-runnable",
    summary: "Ready to launch",
    blockingIssueCount: 0,
    advisoryIssueCount: 0,
    blockingIssues: Object.freeze([]),
    advisoryIssues: Object.freeze([]),
  }),
  updatedAt: "2026-04-08T00:00:00.000Z",
}), Object.freeze({
  systemId: "system:unknown-workflow",
  title: "Legacy setup",
  summary: "Older setup",
  lifecycleState: "active",
  runtimeStatus: "degraded",
  workflowId: "image-template:legacy:v1",
  workflowVersionTag: "v1",
  readinessState: "degraded",
  readinessSummary: "Missing model",
  readiness: Object.freeze({
    state: "configuration-incomplete",
    summary: "Missing model",
    blockingIssueCount: 1,
    advisoryIssueCount: 0,
    blockingIssues: Object.freeze([Object.freeze({
      code: "model-missing",
      path: "workflowBinding.workflowId",
      message: "Bound workflow is unavailable.",
      severity: "blocking" as const,
    })]),
    advisoryIssues: Object.freeze([]),
  }),
  updatedAt: "2026-04-08T00:00:00.000Z",
})]);

describe("SystemWorkflowSelectionPresenter", () => {
  it("presents supported edit types with a stable recommended default", () => {
    const options = presentSupportedEditTypeOptions({
      workflows: workflowSummaries,
    });

    expect(options.length).toBe(2);
    expect(options[0]?.recommended).toBeTrue();
    expect(options[0]?.selected).toBeTrue();
    expect(options[0]?.title).toBe("Restyle from image");
    expect(options[0]?.summary).toContain("Prompt-driven variation");
  });

  it("maps saved systems to user-facing edit type labels when available", () => {
    const options = presentSavedImageSystemOptions({
      systems: savedSystems,
      workflows: workflowSummaries,
      selectedSystemId: "system:unknown-workflow",
    });

    expect(options[0]?.editTypeTitle).toBe("Restyle from image");
    expect(options[1]?.editTypeTitle).toBeUndefined();
    expect(options[1]?.selected).toBeTrue();
    expect(options[0]?.readinessBadgeLabel).toBe("Runnable");
    expect(options[1]?.readinessBadgeLabel).toBe("Blocked");
  });
});
