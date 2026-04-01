import { describe, expect, it } from "bun:test";
import type { IStudioShellRepository } from "../../ports/interfaces/IStudioShellRepository";
import type { AssetDraft, AssetSession, Studio } from "../../../domain/studio-shell/StudioShellDomain";
import type { AssetVersion } from "../../../domain/assets/AssetVersion";
import { DefaultStudioShellApplicationService } from "../../studio-shell/DefaultStudioShellApplicationService";
import { WorkflowStudioApplicationService } from "../../workflow-studio/WorkflowStudioApplicationService";
import {
  createEmptyWorkflowDraft,
  serializeWorkflowDraft,
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import { WorkflowDatasetEventNames, mapDatasetEventToWorkflowTriggerEntries } from "../../workflow-studio/WorkflowDatasetEventTriggerAdapter";
import { InMemoryDatasetEventPublisher } from "../../dataset-events/DatasetEventPublisher";
import { DatasetSchemaIntentIds } from "../../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import { ZodMediaDatasetValidator } from "../../dataset-studio/adapters/validation/MediaDatasetValidator";
import { SystemDatasetInstanceService } from "../SystemDatasetInstanceService";
import { InMemoryDatasetInstanceRepository } from "../DatasetInstanceRepository";
import type { DatasetInstanceAssetCatalog } from "../DatasetInstanceAssetCatalog";
import type { SystemDatasetOwnershipValidator } from "../SystemDatasetInstanceService";
import { DatasetEventTypes } from "../../../domain/dataset-studio/contracts/DatasetEvent";

class InMemoryStudioShellRepository implements IStudioShellRepository {
  private readonly studios = new Map<string, Studio>();
  private readonly sessions = new Map<string, AssetSession>();
  private readonly drafts = new Map<string, AssetDraft>();
  private readonly versions = new Map<string, AssetVersion>();

  async saveStudio(studio: Studio): Promise<Studio> { this.studios.set(studio.id, studio); return studio; }
  async getStudio(studioId: string): Promise<Studio | undefined> { return this.studios.get(studioId); }
  async saveSession(session: AssetSession): Promise<AssetSession> { this.sessions.set(session.id, session); return session; }
  async getSession(sessionId: string): Promise<AssetSession | undefined> { return this.sessions.get(sessionId); }
  async listStudioSessions(studioId: string): Promise<ReadonlyArray<AssetSession>> { return [...this.sessions.values()].filter((entry) => entry.studioId === studioId); }
  async saveDraft(draft: AssetDraft): Promise<AssetDraft> { this.drafts.set(draft.id, draft); return draft; }
  async getDraft(draftId: string): Promise<AssetDraft | undefined> { return this.drafts.get(draftId); }
  async listSessionDrafts(sessionId: string): Promise<ReadonlyArray<AssetDraft>> { return [...this.drafts.values()].filter((entry) => entry.sessionId === sessionId); }
  async saveAssetVersion(version: AssetVersion): Promise<AssetVersion> { this.versions.set(version.versionId, version); return version; }
  async getAssetVersion(versionId: string): Promise<AssetVersion | undefined> { return this.versions.get(versionId); }
  async listAssetVersionsByAssetId(assetId: string): Promise<ReadonlyArray<AssetVersion>> { return [...this.versions.values()].filter((entry) => entry.assetId.value === assetId); }
}

class StaticAssetCatalog implements DatasetInstanceAssetCatalog {
  public resolveAsset(_input: { readonly assetId: string; readonly versionId?: string }): {
    assetId: string;
    versionId: string;
    schemaIntentId: typeof DatasetSchemaIntentIds.media;
    outputShapeKind: "image-metadata-records";
  } {
    return {
      assetId: "image-ingestor-v1",
      versionId: "1.0.0",
      schemaIntentId: DatasetSchemaIntentIds.media,
      outputShapeKind: "image-metadata-records",
    };
  }
}

class AllowListSystemValidator implements SystemDatasetOwnershipValidator {
  public assertSystemExists(systemId: string): void {
    if (systemId !== "system:image-pipeline") {
      throw new Error(`invalid-request:System '${systemId}' is not available.`);
    }
  }
}

function createWorkflowService(): WorkflowStudioApplicationService {
  const repository = new InMemoryStudioShellRepository();
  const studioShell = new DefaultStudioShellApplicationService(repository, () => "generated");
  return new WorkflowStudioApplicationService(studioShell);
}

function createDatasetService(publisher: InMemoryDatasetEventPublisher): SystemDatasetInstanceService {
  return new SystemDatasetInstanceService(
    new InMemoryDatasetInstanceRepository(),
    new StaticAssetCatalog(),
    new ZodMediaDatasetValidator(),
    new AllowListSystemValidator(),
    { datasetEventPublisher: publisher },
  );
}

describe("Dataset event -> workflow trigger integration", () => {
  it("emits image dataset events and executes mapped workflow triggers end to end", async () => {
    const publisher = new InMemoryDatasetEventPublisher();
    const datasetService = createDatasetService(publisher);
    const workflowService = createWorkflowService();

    const draft = {
      ...createEmptyWorkflowDraft(),
      triggers: [
        {
          id: "trigger-image-added",
          kind: WorkflowDraftTriggerKinds.state,
          type: WorkflowDraftTriggerTypes.stateSystemEvent,
          config: { sourceType: "system", eventCategory: "system-state-changed", eventName: WorkflowDatasetEventNames.imageAdded },
        },
        {
          id: "trigger-image-updated",
          kind: WorkflowDraftTriggerKinds.state,
          type: WorkflowDraftTriggerTypes.stateSystemEvent,
          config: { sourceType: "system", eventCategory: "system-state-changed", eventName: WorkflowDatasetEventNames.imageUpdated },
        },
        {
          id: "trigger-image-generated",
          kind: WorkflowDraftTriggerKinds.state,
          type: WorkflowDraftTriggerTypes.stateDataAvailable,
          config: { sourceType: "dataset", eventCategory: "data-ingested", eventName: WorkflowDatasetEventNames.imageGenerated },
        },
        {
          id: "trigger-image-selected",
          kind: WorkflowDraftTriggerKinds.state,
          type: WorkflowDraftTriggerTypes.stateSystemEvent,
          config: { sourceType: "system", eventCategory: "system-state-changed", eventName: WorkflowDatasetEventNames.imageSelected },
        },
      ],
      inputs: [{
        id: "input-dataset-event-type",
        type: "runtime-input",
        sourceType: "runtime-parameter",
        parameterKey: "datasetEventType",
        required: true,
      }],
      steps: [{ id: "step-1", type: "action", kind: "action", order: 1 }],
    } as const;

    const instance = await datasetService.ensureOutputImageStoreInstance({
      systemId: "system:image-pipeline",
      instanceId: "instance:event-integration",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    const added = await datasetService.ingestImageRecordIntoInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      record: { assetRef: { assetId: "asset:image:1" }, width: 256, height: 256, format: "png" },
    });

    await datasetService.updateImageRecordInInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      recordId: added.recordId,
      patch: { metadataPatch: { set: { approved: true } } },
    });

    const generated = await datasetService.ingestImageRecordIntoInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      record: {
        assetRef: { kind: "generated-output", stableId: "generated-output:artifact://image-2.png", outputId: "artifact://image-2.png" },
        width: 512,
        height: 512,
        format: "png",
      },
      storageProvider: "generated-output",
      storageReference: "artifact://image-2.png",
      provenance: { sourceType: "generated-output", sourceRunId: "run-1" },
    });

    await datasetService.selectImageRecordInInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      recordId: generated.recordId,
    });

    const eventTypes = publisher.listPublishedEvents().map((event) => event.eventType);
    expect(eventTypes).toEqual([
      DatasetEventTypes.imageAdded,
      DatasetEventTypes.imageUpdated,
      DatasetEventTypes.imageGenerated,
      DatasetEventTypes.imageSelected,
    ]);
    const mappedTriggerEntries = publisher.listPublishedEvents()
      .flatMap((event) => mapDatasetEventToWorkflowTriggerEntries({ draft, event }).entries);

    const executionStatuses: string[] = [];
    for (const trigger of mappedTriggerEntries) {
      const result = await workflowService.runWorkflowDraftTriggered({
        content: serializeWorkflowDraft(draft),
        trigger,
      });
      executionStatuses.push(result.executionStatus.state);
      expect(result.validation.plan?.executionContext.resolvedInputValues["input-dataset-event-type"]).toBeTruthy();
    }

    expect(mappedTriggerEntries).toHaveLength(4);
    expect(executionStatuses).toEqual(["completed", "completed", "completed", "completed"]);
  });

  it("safely handles malformed/invalid dataset events, failed mutations, duplicates, and subscriber failures", async () => {
    const publisher = new InMemoryDatasetEventPublisher();
    const datasetService = createDatasetService(publisher);
    const workflowService = createWorkflowService();

    const draft = {
      ...createEmptyWorkflowDraft(),
      triggers: [{
        id: "trigger-image-added",
        kind: WorkflowDraftTriggerKinds.state,
        type: WorkflowDraftTriggerTypes.stateSystemEvent,
        config: { sourceType: "system", eventCategory: "system-state-changed", eventName: WorkflowDatasetEventNames.imageAdded },
      }],
      inputs: [{
        id: "input-dataset-event-type",
        type: "runtime-input",
        sourceType: "runtime-parameter",
        parameterKey: "datasetEventType",
        required: true,
      }],
      steps: [{ id: "step-1", type: "action", kind: "action", order: 1 }],
    } as const;

    const instance = await datasetService.ensureInputImageStoreInstance({
      systemId: "system:image-pipeline",
      instanceId: "instance:event-integration-negative",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    const mappedEntries: Array<ReturnType<typeof mapDatasetEventToWorkflowTriggerEntries>["entries"][number]> = [];
    publisher.subscribe({ listener: () => { throw new Error("subscriber-failure"); } });
    publisher.subscribe({
      listener: (event) => {
        const mapped = mapDatasetEventToWorkflowTriggerEntries({ draft, event });
        mappedEntries.push(...mapped.entries);
      },
    });

    const record = await datasetService.ingestImageRecordIntoInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      recordId: "record:stable",
      record: { assetRef: { assetId: "asset:image:negative" }, width: 320, height: 240, format: "png" },
    });

    await expect(datasetService.updateImageRecordInInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      recordId: "record:missing",
      patch: { metadataPatch: { set: { note: "should-fail" } } },
    })).rejects.toThrow("not found");

    const malformed = mapDatasetEventToWorkflowTriggerEntries({ draft, event: { eventId: "broken" } as never });
    expect(malformed.entries).toHaveLength(0);
    expect(malformed.issues[0]?.code).toBe("dataset-event-malformed");

    publisher.publish({ event: publisher.listPublishedEvents()[0]! });

    const noOpSelectionFirst = await datasetService.selectImageRecordInInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      recordId: record.recordId,
    });
    const noOpSelectionSecond = await datasetService.selectImageRecordInInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      recordId: record.recordId,
    });

    expect(noOpSelectionFirst.changed).toBeTrue();
    expect(noOpSelectionSecond.changed).toBeFalse();
    expect(publisher.listDeliveryFailures().length).toBeGreaterThanOrEqual(2);
    expect(publisher.listPublishedEvents().filter((event) => event.eventType === DatasetEventTypes.imageUpdated)).toHaveLength(0);

    expect(mappedEntries.length).toBeGreaterThanOrEqual(1);

    const run = await workflowService.runWorkflowDraftTriggered({
      content: serializeWorkflowDraft(draft),
      trigger: mappedEntries[0]!,
    });
    expect(run.executionStatus.state).toBe("completed");
  });
});
