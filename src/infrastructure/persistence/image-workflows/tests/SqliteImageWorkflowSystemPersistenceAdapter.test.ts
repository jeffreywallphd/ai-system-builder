import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ImageWorkflowActivationStatuses,
  ImageWorkflowLifecycleStates,
  createImageWorkflowDefinition,
  transitionImageWorkflowLifecycle,
  type ImageWorkflowDefinition,
} from "@domain/image-workflows/ImageWorkflowDomain";
import {
  ImageSystemLifecycleStates,
  ImageSystemRuntimeStatuses,
  createImageSystemDefinition,
  type ImageSystemDefinition,
} from "@domain/systems/ImageSystemDomain";
import { PersistenceOptimisticConcurrencyError } from "@shared/persistence/PersistenceVersioning";
import { openSqliteCompatDatabase } from "../../sqlite/SqliteCompat";
import { SqliteImageWorkflowSystemPersistenceAdapter } from "../SqliteImageWorkflowSystemPersistenceAdapter";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

function createWorkflow(input?: {
  readonly workflowId?: string;
  readonly versionTag?: string;
  readonly revision?: number;
  readonly lifecycleState?: ImageWorkflowDefinition["lifecycleState"];
  readonly activationStatus?: ImageWorkflowDefinition["activationStatus"];
}): ImageWorkflowDefinition {
  return createImageWorkflowDefinition({
    workflowId: input?.workflowId ?? "workflow:image:alpha:v1",
    operationKind: "image-to-image",
    ownership: {
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      visibility: "team",
    },
    display: {
      title: "Workflow Alpha",
      tags: ["image", "alpha"],
    },
    version: {
      lineageId: "workflow-lineage-alpha",
      versionTag: input?.versionTag ?? "1.0.0",
      revision: input?.revision ?? 1,
    },
    lifecycleState: input?.lifecycleState ?? ImageWorkflowLifecycleStates.published,
    activationStatus: input?.activationStatus ?? ImageWorkflowActivationStatuses.active,
    inputSlots: [{
      inputId: "source-image",
      label: "Source image",
      kind: "source-image",
      valueType: "image-asset-reference",
      required: true,
      allowsMultiple: false,
      acceptedAssetKinds: ["image-asset"],
    }],
    inputBindings: [{
      bindingId: "input-source-image",
      inputId: "source-image",
      sourceKind: "selected-image",
      sourceKey: "selection.primary",
      required: true,
    }],
    parameterSpecifications: [{
      parameterId: "strength",
      label: "Strength",
      valueKind: "float",
      semanticMeaning: "variation-strength",
      required: true,
      defaultValue: 0.5,
      validation: {
        minimum: 0,
        maximum: 1,
      },
    }],
    outputExpectations: [{
      outputId: "generated-image",
      label: "Generated image",
      kind: "generated-image",
      valueType: "image-asset-reference",
      required: true,
      allowsMultiple: false,
    }],
    outputBindings: [{
      bindingId: "output-generated-image",
      outputId: "generated-image",
      targetType: "output-dataset",
      requiredTargetId: false,
    }],
    backendTranslation: {
      translatorId: "translator:image-to-image",
      contractVersion: "1.0.0",
      templateId: "template:image-to-image:v1",
      inputBindings: [{ inputId: "source-image", backendField: "inputs.source" }],
      parameterBindings: [{ parameterId: "strength", backendField: "inputs.strength" }],
      outputBindings: [{ outputId: "generated-image", backendField: "outputs.generated" }],
    },
    createdBy: "user-owner",
    now: new Date("2026-04-08T12:00:00.000Z"),
  });
}

function createSystem(workflow: ImageWorkflowDefinition, input?: {
  readonly systemId?: string;
}): ImageSystemDefinition {
  return createImageSystemDefinition({
    systemId: input?.systemId ?? "system:image:alpha",
    ownership: {
      workspaceId: workflow.ownership.workspaceId,
      ownerUserId: "user-owner",
      visibility: "team",
      sharingPolicyId: "sharing-policy-alpha",
      sharingPolicyVersion: "1",
    },
    display: {
      title: "System Alpha",
      tags: ["system", "alpha"],
    },
    workflowBinding: {
      workflowId: workflow.workflowId,
      workflowWorkspaceId: workflow.ownership.workspaceId,
      workflowLineageId: workflow.version.lineageId,
      workflowVersionTag: workflow.version.versionTag,
      workflowRevision: workflow.version.revision,
      requiredInputIds: ["source-image"],
      requiredParameterIds: ["strength"],
      requiredOutputIds: ["generated-image"],
    },
    inputAssetSelections: [{
      inputId: "source-image",
      assetReference: "asset://source-image-001",
    }],
    outputTargetBindings: [{
      outputId: "generated-image",
      targetReference: "dataset-instance://generated-images",
    }],
    parameterBaseline: {
      values: {
        strength: 0.7,
      },
      profileReferences: [],
    },
    lifecycleState: ImageSystemLifecycleStates.ready,
    runtimeStatus: ImageSystemRuntimeStatuses.enabled,
    createdBy: "user-owner",
    now: new Date("2026-04-08T12:00:00.000Z"),
  });
}

describe("SqliteImageWorkflowSystemPersistenceAdapter", () => {
  it("applies migrations and creates workflow/system authoritative persistence tables", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-image-workflow-schema-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "image-workflow-system.sqlite");

    const adapter = new SqliteImageWorkflowSystemPersistenceAdapter(databasePath);
    await adapter.listWorkflowDefinitions({ workspaceId: "workspace-alpha" });
    adapter.dispose();

    const database = openSqliteCompatDatabase(databasePath);
    const versionRow = database.prepare(
      "SELECT MAX(version) AS version FROM image_workflow_system_repository_migrations",
    ).get() as { version?: number };
    expect(versionRow.version).toBe(1);

    const tables = database.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN (
          'image_workflow_definition_records',
          'image_system_definition_records',
          'image_workflow_system_mutation_replays',
          'image_workflow_system_repository_migrations'
        )
      ORDER BY name ASC
    `).all() as Array<{ name: string }>;
    expect(tables.map((table) => table.name)).toEqual([
      "image_system_definition_records",
      "image_workflow_definition_records",
      "image_workflow_system_mutation_replays",
      "image_workflow_system_repository_migrations",
    ]);

    database.close();
  });

  it("persists workflow definitions with list/read/version-resolution/archive and replay-safe mutation behavior", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-image-workflow-roundtrip-"));
    createdRoots.push(root);
    const adapter = new SqliteImageWorkflowSystemPersistenceAdapter(path.join(root, "image-workflow-system.sqlite"));

    const workflowV1 = createWorkflow({
      workflowId: "workflow:image:alpha:v1",
      versionTag: "1.0.0",
      revision: 1,
      lifecycleState: ImageWorkflowLifecycleStates.published,
      activationStatus: ImageWorkflowActivationStatuses.inactive,
    });
    const workflowV2 = createWorkflow({
      workflowId: "workflow:image:alpha:v2",
      versionTag: "1.1.0",
      revision: 2,
      lifecycleState: ImageWorkflowLifecycleStates.published,
      activationStatus: ImageWorkflowActivationStatuses.active,
    });

    await adapter.createWorkflowDefinition(workflowV1, {
      operationKey: "op:image-workflow:create:v1",
      actorUserId: "user-owner",
      occurredAt: "2026-04-08T12:00:00.000Z",
    });
    const createdV2 = await adapter.createWorkflowDefinition(workflowV2, {
      operationKey: "op:image-workflow:create:v2",
      actorUserId: "user-owner",
      occurredAt: "2026-04-08T12:05:00.000Z",
    });

    expect(createdV2.changed).toBeTrue();
    expect(createdV2.wasReplay).toBeFalse();

    const replayV2 = await adapter.createWorkflowDefinition(workflowV2, {
      operationKey: "op:image-workflow:create:v2",
      actorUserId: "user-owner",
      occurredAt: "2026-04-08T12:05:05.000Z",
    });
    expect(replayV2.wasReplay).toBeTrue();
    expect(replayV2.changed).toBeFalse();

    const listedActive = await adapter.listWorkflowDefinitions({
      workspaceId: "workspace-alpha",
      activationStatuses: [ImageWorkflowActivationStatuses.active],
      tags: ["alpha"],
    });
    expect(listedActive).toHaveLength(1);
    expect(listedActive[0]?.workflowId).toBe("workflow:image:alpha:v2");

    const resolved = await adapter.resolveWorkflowDefinitionVersion({
      workspaceId: "workspace-alpha",
      selector: {
        strategy: "active-published-in-lineage",
        lineageId: "workflow-lineage-alpha",
      },
    });
    expect(resolved?.workflowId).toBe("workflow:image:alpha:v2");

    const translation = await adapter.getWorkflowBackendTranslationReference({
      workspaceId: "workspace-alpha",
      selector: {
        strategy: "workflow-id",
        workflowId: "workflow:image:alpha:v2",
      },
    });
    expect(translation?.templateId).toBe("template:image-to-image:v1");

    const updatedV2 = transitionImageWorkflowLifecycle(workflowV2, {
      targetState: ImageWorkflowLifecycleStates.deprecated,
      actorUserId: "user-owner",
      now: new Date("2026-04-08T12:06:00.000Z"),
    });
    await adapter.saveWorkflowDefinition(updatedV2, {
      operationKey: "op:image-workflow:save:v2",
      actorUserId: "user-owner",
      occurredAt: "2026-04-08T12:06:00.000Z",
      expectedRevision: 1,
    });

    await expect(adapter.saveWorkflowDefinition(updatedV2, {
      operationKey: "op:image-workflow:save:v2:stale",
      actorUserId: "user-owner",
      occurredAt: "2026-04-08T12:07:00.000Z",
      expectedRevision: 1,
    })).rejects.toBeInstanceOf(PersistenceOptimisticConcurrencyError);

    const archived = await adapter.archiveWorkflowDefinition("workflow:image:alpha:v2", {
      operationKey: "op:image-workflow:archive:v2",
      actorUserId: "user-owner",
      occurredAt: "2026-04-08T12:08:00.000Z",
    });
    expect(archived?.record.lifecycleState).toBe(ImageWorkflowLifecycleStates.retired);

    const hiddenRetired = await adapter.findWorkflowDefinitionById("workflow:image:alpha:v2", {
      workspaceId: "workspace-alpha",
    });
    expect(hiddenRetired).toBeUndefined();

    const includedRetired = await adapter.findWorkflowDefinitionById("workflow:image:alpha:v2", {
      workspaceId: "workspace-alpha",
      includeRetired: true,
    });
    expect(includedRetired?.lifecycleState).toBe(ImageWorkflowLifecycleStates.retired);

    adapter.dispose();
  });

  it("persists system definitions durably for read/list/archive and supports reopen after restart", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-image-system-roundtrip-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "image-workflow-system.sqlite");

    const adapter = new SqliteImageWorkflowSystemPersistenceAdapter(databasePath);
    const workflow = createWorkflow({
      workflowId: "workflow:image:beta:v1",
      versionTag: "2.0.0",
      revision: 1,
    });

    await adapter.createWorkflowDefinition(workflow, {
      operationKey: "op:image-workflow:create:beta",
      actorUserId: "user-owner",
      occurredAt: "2026-04-08T13:00:00.000Z",
    });

    const system = createSystem(workflow, { systemId: "system:image:beta" });
    await adapter.createSystemDefinition(system, {
      operationKey: "op:image-system:create:beta",
      actorUserId: "user-owner",
      occurredAt: "2026-04-08T13:01:00.000Z",
    });

    const listed = await adapter.listSystemDefinitions({
      workspaceId: "workspace-alpha",
      sharingPolicyIds: ["sharing-policy-alpha"],
      workflowIds: [workflow.workflowId],
      tags: ["alpha"],
    });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.systemId).toBe("system:image:beta");

    const archived = await adapter.archiveSystemDefinition("system:image:beta", {
      operationKey: "op:image-system:archive:beta",
      actorUserId: "user-owner",
      occurredAt: "2026-04-08T13:02:00.000Z",
    });
    expect(archived?.record.lifecycleState).toBe(ImageSystemLifecycleStates.archived);
    expect(archived?.record.runtimeStatus).toBe(ImageSystemRuntimeStatuses.disabled);

    const hidden = await adapter.findSystemDefinitionById("system:image:beta", {
      workspaceId: "workspace-alpha",
    });
    expect(hidden).toBeUndefined();

    adapter.dispose();

    const reopened = new SqliteImageWorkflowSystemPersistenceAdapter(databasePath);
    const restoredSystem = await reopened.findSystemDefinitionById("system:image:beta", {
      workspaceId: "workspace-alpha",
      includeArchived: true,
    });
    expect(restoredSystem?.systemId).toBe("system:image:beta");
    expect(restoredSystem?.workflowBinding.workflowId).toBe("workflow:image:beta:v1");

    const restoredWorkflow = await reopened.findWorkflowDefinitionById("workflow:image:beta:v1", {
      workspaceId: "workspace-alpha",
      includeRetired: true,
    });
    expect(restoredWorkflow?.workflowId).toBe("workflow:image:beta:v1");

    reopened.dispose();
  });
});
