import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SystemBuildTemplateCatalog } from "@application/system-studio/SystemBuildTemplateCatalog";
import { InMemoryStudioShellRepository } from "@infrastructure/studio-shell/InMemoryStudioShellRepository";
import { SqliteImageWorkflowSystemPersistenceAdapter } from "@infrastructure/persistence/image-workflows/SqliteImageWorkflowSystemPersistenceAdapter";
import { StudioShellBackendApi } from "../StudioShellBackendApi";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

function applyWorkflowAuthoringState(
  content: string,
  workflowId: string,
  workflowVersionId: string | undefined,
  parameterValues: Readonly<Record<string, unknown>>,
): string {
  const root = (content.trim() ? JSON.parse(content) : {}) as {
    readonly systemSpec?: {
      readonly serialization?: {
        readonly runtime?: {
          readonly state?: {
            readonly imageWorkflowParameterValuesByWorkflowId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
          };
        };
      };
    };
  };
  const systemSpec = root.systemSpec ?? {};
  const serialization = systemSpec.serialization ?? {};
  const runtime = serialization.runtime ?? {};
  const state = runtime.state ?? {};
  const parameterMap = state.imageWorkflowParameterValuesByWorkflowId ?? {};

  return JSON.stringify({
    ...root,
    systemSpec: {
      ...systemSpec,
      serialization: {
        ...serialization,
        runtime: {
          ...runtime,
          workflowBindings: [{
            bindingId: "component:primary",
            workflowAssetId: workflowId,
            workflowVersionId,
          }],
          state: {
            ...state,
            imageWorkflowParameterValuesByWorkflowId: {
              ...parameterMap,
              [workflowId]: {
                ...(parameterMap[workflowId] ?? {}),
                ...parameterValues,
              },
            },
          },
        },
      },
    },
  });
}

function buildConfiguredParameterValues(detail: {
  readonly parameterDefaults: Readonly<Record<string, unknown>>;
  readonly parameterSpecifications: ReadonlyArray<{
    readonly parameterId: string;
    readonly required: boolean;
    readonly valueKind: string;
  }>;
}): Readonly<Record<string, unknown>> {
  const values: Record<string, unknown> = { ...detail.parameterDefaults };
  for (const specification of detail.parameterSpecifications) {
    if (!specification.required || values[specification.parameterId] !== undefined) {
      continue;
    }
    switch (specification.valueKind) {
      case "integer":
        values[specification.parameterId] = 1;
        break;
      case "float":
        values[specification.parameterId] = 0.5;
        break;
      case "boolean":
        values[specification.parameterId] = true;
        break;
      case "text":
      case "select":
        values[specification.parameterId] = "configured";
        break;
      default:
        break;
    }
  }
  return values;
}

describe("Feature 2 workflow/system definition authoring e2e", () => {
  it("authors, saves, reopens, and durably reloads supported workflows through authoritative APIs", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-feature2-authoring-e2e-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "image-workflow-system.sqlite");
    const systemRepository = new SqliteImageWorkflowSystemPersistenceAdapter(databasePath);
    const api = new StudioShellBackendApi(
      new InMemoryStudioShellRepository(),
      undefined,
      undefined,
      () => new Date(),
      undefined,
      {
        imageSystemDefinitionRepository: systemRepository,
      },
    );
    const template = SystemBuildTemplateCatalog[0]!;

    const initialized = await api.initializeStudio("studio-feature2-authoring", "System Studio");
    expect(initialized.ok).toBeTrue();
    const sessionId = initialized.data!.activeSessionId!;

    const workflowListing = await api.listImageWorkflowDefinitions({
      workspaceId: "workspace:studio-shell",
      actorUserId: "user:studio-shell",
      limit: 50,
      offset: 0,
    });
    expect(workflowListing.ok).toBeTrue();
    const workflowIds = (workflowListing.data?.items ?? []).map((entry) => entry.workflowId);
    expect(workflowIds).toEqual(expect.arrayContaining([
      "image-template:image-to-image-restyle:v1",
      "image-template:enhance-upscale:v1",
      "image-template:mask-guided-edit:v1",
    ]));

    const savedByWorkflowId = new Map<string, string>();

    for (const workflowId of workflowIds) {
      const workflowDetail = await api.getImageWorkflowDefinition({
        workspaceId: "workspace:studio-shell",
        actorUserId: "user:studio-shell",
        workflowId,
      });
      expect(workflowDetail.ok).toBeTrue();
      const configuredValues = buildConfiguredParameterValues({
        parameterDefaults: workflowDetail.data!.parameterDefaults,
        parameterSpecifications: workflowDetail.data!.parameterSpecifications,
      });

      const draft = await api.createDraft({
        studioId: "studio-feature2-authoring",
        sessionId,
        assetId: template.draftSeed.assetId,
        content: applyWorkflowAuthoringState(
          template.draftSeed.contentTemplate,
          workflowId,
          workflowDetail.data?.version.versionTag,
          configuredValues,
        ),
        metadata: {
          title: `${workflowDetail.data?.title} System`,
          summary: workflowDetail.data?.summary,
          tags: ["system", "image-manipulation", workflowId],
          taxonomy: template.draftSeed.metadataPatch.taxonomy!,
          provenance: template.draftSeed.metadataPatch.provenance,
        },
        dependencies: template.draftSeed.dependencies,
      });
      expect(draft.ok).toBeTrue();
      const draftId = draft.data!.draft!.draftId;

      const saved = await api.saveImageSystemDefinition({
        studioId: "studio-feature2-authoring",
        sessionId,
        draftId,
        saveAsNew: true,
      });
      expect(saved.ok).toBeTrue();
      expect(saved.data?.workflowId).toBe(workflowId);
      expect(saved.data?.readinessSummary.length ?? 0).toBeGreaterThan(0);
      expect(saved.data?.readiness.blockingIssueCount).toBeGreaterThanOrEqual(0);
      expect(saved.data?.readiness.advisoryIssueCount).toBeGreaterThanOrEqual(0);
      expect(saved.data?.parameterBaseline).toEqual(expect.objectContaining(configuredValues));
      savedByWorkflowId.set(workflowId, saved.data!.systemId);

      const reopened = await api.getImageSystemDefinition({
        workspaceId: "workspace:studio-shell",
        actorUserId: "user:studio-shell",
        systemId: saved.data!.systemId,
      });
      expect(reopened.ok).toBeTrue();
      expect(reopened.data?.workflowId).toBe(workflowId);
      expect(reopened.data?.readinessSummary.length ?? 0).toBeGreaterThan(0);
      expect(reopened.data?.parameterBaseline).toEqual(expect.objectContaining(configuredValues));
    }

    const listed = await api.listImageSystemDefinitions({
      workspaceId: "workspace:studio-shell",
      actorUserId: "user:studio-shell",
      limit: 100,
      offset: 0,
    });
    expect(listed.ok).toBeTrue();
    expect(savedByWorkflowId.size).toBeGreaterThan(0);
    for (const [workflowId, systemId] of savedByWorkflowId.entries()) {
      expect(listed.data?.items.some((entry) => entry.systemId === systemId && entry.workflowId === workflowId)).toBeTrue();
    }

    systemRepository.dispose();
    const reopenedRepository = new SqliteImageWorkflowSystemPersistenceAdapter(databasePath);
    try {
      const restartedApi = new StudioShellBackendApi(
        new InMemoryStudioShellRepository(),
        undefined,
        undefined,
        () => new Date(),
        undefined,
        {
          imageSystemDefinitionRepository: reopenedRepository,
        },
      );
      const afterRestart = await restartedApi.listImageSystemDefinitions({
        workspaceId: "workspace:studio-shell",
        actorUserId: "user:studio-shell",
        limit: 100,
        offset: 0,
      });
      expect(afterRestart.ok).toBeTrue();
      for (const [workflowId, systemId] of savedByWorkflowId.entries()) {
        expect(afterRestart.data?.items.some((entry) => entry.systemId === systemId && entry.workflowId === workflowId)).toBeTrue();
      }
    } finally {
      reopenedRepository.dispose();
    }
  });

  it("rejects unsupported workflow IDs so authoring remains bound to the supported workflow set", async () => {
    const api = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const template = SystemBuildTemplateCatalog[0]!;
    const initialized = await api.initializeStudio("studio-feature2-supported-set", "System Studio");
    const sessionId = initialized.data!.activeSessionId!;
    const created = await api.createDraft({
      studioId: "studio-feature2-supported-set",
      sessionId,
      assetId: template.draftSeed.assetId,
      content: applyWorkflowAuthoringState(
        template.draftSeed.contentTemplate,
        "image-template:unsupported-placeholder:v1",
        "v1",
        {
          resultCount: 1,
        },
      ),
      metadata: {
        title: "Unsupported workflow system",
        summary: "This should fail.",
        tags: ["system", "image-manipulation", "unsupported"],
        taxonomy: template.draftSeed.metadataPatch.taxonomy!,
        provenance: template.draftSeed.metadataPatch.provenance,
      },
      dependencies: template.draftSeed.dependencies,
    });
    expect(created.ok).toBeTrue();

    const saved = await api.saveImageSystemDefinition({
      studioId: "studio-feature2-supported-set",
      sessionId,
      draftId: created.data!.draft!.draftId,
      saveAsNew: true,
    });
    expect(saved.ok).toBeFalse();
    expect(saved.error?.code).toBe("invalid-request");
    expect(saved.error?.message).toContain("is not supported");
  });
});
