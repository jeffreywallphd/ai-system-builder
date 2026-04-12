import { describe, expect, it } from "bun:test";
import {
  toCreateImageWorkflowResponseDto,
  toGetImageSystemResponseDto,
} from "../ImageWorkflowSystemApiDtos";
import {
  ImageWorkflowApiReadinessStates,
  ImageWorkflowSystemApiContractVersions,
} from "../../../contracts/image-workflows/ImageWorkflowSystemApiContracts";

describe("ImageWorkflowSystemApiDtos", () => {
  it("projects immutable workflow response DTOs", () => {
    const response = toCreateImageWorkflowResponseDto({
      contractVersion: ImageWorkflowSystemApiContractVersions.v1,
      workflow: {
        workflowId: "wf:image:1",
        workspaceId: "workspace:alpha",
        title: "Portrait Restyle",
        tags: ["portrait"],
        operationKind: "restyle",
        lifecycleState: "draft",
        activationStatus: "inactive",
        version: {
          lineageId: "lineage:image:1",
          versionTag: "1.0.0",
          revision: 0,
        },
        compatibility: {
          contractVersion: ImageWorkflowSystemApiContractVersions.v1,
          supportedClients: ["desktop", "thin-client"],
          executionAdapterId: "comfyui-image",
          executionAdapterVersion: "2026.04",
        },
        inputSlots: [],
        outputSlots: [],
        parameterSpecifications: [],
        createdBy: "user:1",
        lastModifiedBy: "user:1",
        createdAt: "2026-04-08T10:00:00.000Z",
        updatedAt: "2026-04-08T10:00:00.000Z",
      },
      readiness: {
        state: ImageWorkflowApiReadinessStates.definitionReady,
        ready: true,
        checkedAt: "2026-04-08T10:00:00.000Z",
      },
      validation: {
        valid: true,
        issues: [],
      },
    });

    expect(Object.isFrozen(response)).toBeTrue();
    expect(response.workflow.workflowId).toBe("wf:image:1");
  });

  it("projects immutable system detail DTOs", () => {
    const response = toGetImageSystemResponseDto({
      contractVersion: ImageWorkflowSystemApiContractVersions.v1,
      system: {
        systemId: "sys:image:1",
        workspaceId: "workspace:alpha",
        title: "Editorial Portrait System",
        tags: [],
        lifecycleState: "ready",
        runtimeStatus: "enabled",
        workflowBinding: {
          workflowId: "wf:image:1",
          workflowVersionTag: "1.0.0",
          workflowRevision: 0,
          workflowLineageId: "lineage:image:1",
        },
        inputBindings: [],
        outputBindings: [],
        parameterValues: [],
        lineage: {
          latestOutputAssetIds: [],
        },
        compatibility: {
          contractVersion: ImageWorkflowSystemApiContractVersions.v1,
          supportedClients: ["desktop", "thin-client"],
          executionAdapterId: "comfyui-image",
          executionAdapterVersion: "2026.04",
        },
        createdBy: "user:1",
        lastModifiedBy: "user:1",
        createdAt: "2026-04-08T10:00:00.000Z",
        updatedAt: "2026-04-08T10:05:00.000Z",
      },
      readiness: {
        state: ImageWorkflowApiReadinessStates.configurationRunnable,
        ready: true,
        checkedAt: "2026-04-08T10:05:00.000Z",
      },
    });

    expect(Object.isFrozen(response)).toBeTrue();
    expect(response.system.runtimeStatus).toBe("enabled");
  });
});
