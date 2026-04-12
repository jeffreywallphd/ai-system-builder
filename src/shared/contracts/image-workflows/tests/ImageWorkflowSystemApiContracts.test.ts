import { describe, expect, it } from "bun:test";
import {
  ImageWorkflowApiReadinessStates,
  toListImageSystemsQueryParams,
  toListImageWorkflowsQueryParams,
  createDefaultImageWorkflowApiReadiness,
  createDefaultImageWorkflowApiValidationResult,
} from "../ImageWorkflowSystemApiContracts";

describe("ImageWorkflowSystemApiContracts", () => {
  it("serializes workflow list query params with repeated filters", () => {
    const query = toListImageWorkflowsQueryParams({
      contractVersion: "image-workflow-system-api/v1",
      workspaceId: "workspace:alpha",
      lifecycleStates: ["draft", "published"],
      activationStatuses: ["active"],
      operationKinds: ["image-to-image", "restyle"],
      tags: ["portrait", "studio"],
      search: "editorial",
      limit: 25,
      offset: 10,
    });

    expect(query.get("workspaceId")).toBe("workspace:alpha");
    expect(query.getAll("lifecycleState")).toEqual(["draft", "published"]);
    expect(query.getAll("operationKind")).toEqual(["image-to-image", "restyle"]);
    expect(query.getAll("tag")).toEqual(["portrait", "studio"]);
    expect(query.get("limit")).toBe("25");
    expect(query.get("offset")).toBe("10");
  });

  it("serializes system list query params and omits unset optionals", () => {
    const query = toListImageSystemsQueryParams({
      contractVersion: "image-workflow-system-api/v1",
      workspaceId: "workspace:alpha",
      workflowId: "wf:image:1",
      lifecycleStates: ["ready"],
      runtimeStatuses: ["enabled"],
    });

    expect(query.get("workspaceId")).toBe("workspace:alpha");
    expect(query.get("workflowId")).toBe("wf:image:1");
    expect(query.getAll("lifecycleState")).toEqual(["ready"]);
    expect(query.getAll("runtimeStatus")).toEqual(["enabled"]);
    expect(query.has("search")).toBeFalse();
  });

  it("derives readiness and validation defaults deterministically", () => {
    const readiness = createDefaultImageWorkflowApiReadiness({
      state: ImageWorkflowApiReadinessStates.configurationRunnable,
      checkedAt: "2026-04-08T12:00:00.000Z",
    });
    expect(readiness.ready).toBeTrue();

    const validation = createDefaultImageWorkflowApiValidationResult([
      { code: "warn", message: "non-blocking", path: "workflow", severity: "warning" },
      { code: "error", message: "blocking", path: "workflow.inputSlots", severity: "error" },
    ]);
    expect(validation.valid).toBeFalse();
    expect(validation.issues).toHaveLength(2);
  });
});
