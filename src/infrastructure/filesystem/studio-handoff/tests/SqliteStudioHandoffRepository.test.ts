import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import {
  StudioHandoffPersistenceService,
  StudioHandoffQueryService,
  type PersistedStudioHandoffRecord,
} from "../../../../application/studio-handoff/StudioHandoffPersistenceService";
import { SqliteStudioHandoffRepository } from "../SqliteStudioHandoffRepository";
import {
  createStudioHandoffContract,
  StudioHandoffAssetRoles,
  StudioHandoffIntentKinds,
} from "../../../../domain/studio-handoff/StudioHandoffContract";
import { createStudioHandoffContext } from "../../../../domain/studio-handoff/StudioHandoffContext";
import {
  createCompositionTaxonomyDescriptor,
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  TaxonomyStructuralKinds,
} from "../../../../domain/taxonomy/CompositionTaxonomy";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) {
      continue;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createRepository() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-handoff-sqlite-"));
  tempDirs.push(dir);
  return new SqliteStudioHandoffRepository(path.join(dir, "handoff.db"));
}

function createPreparedRecord(handoffId: string, versionId = "asset:dataset:v1"): PersistedStudioHandoffRecord {
  const taxonomy = createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.atomic,
    semanticRole: TaxonomySemanticRoles.dataset,
    behaviorKind: TaxonomyBehaviorKinds.none,
  });

  const handoff = createStudioHandoffContract({
    id: handoffId,
    source: {
      studioId: "dataset-studio-default",
      studioType: "dataset-studio",
    },
    target: {
      studioId: "workflow-studio-default",
      studioType: "workflow-studio",
    },
    payload: {
      assetId: "asset:dataset",
      versionId,
      taxonomy,
      targetInputContract: {
        contractId: "workflow-default-input",
      },
    },
    multiAsset: {
      grouped: true,
      requireAllAssets: true,
      assets: [
        {
          role: StudioHandoffAssetRoles.primary,
          assetId: "asset:dataset",
          versionId,
          taxonomy,
        },
      ],
    },
    intent: {
      kind: StudioHandoffIntentKinds.authoringContinuation,
    },
  });

  const context = createStudioHandoffContext({
    sourceStudioId: handoff.source.studioId,
    sourceStudioType: handoff.source.studioType,
    targetStudioId: handoff.target.studioId,
    targetStudioType: handoff.target.studioType,
    intent: handoff.intent,
    sourceReferences: [{ assetId: handoff.payload.assetId, versionId: handoff.payload.versionId, relation: "primary" }],
  });

  return {
    handoffId,
    sourceStudioId: handoff.source.studioId,
    sourceStudioType: handoff.source.studioType,
    targetStudioId: handoff.target.studioId,
    targetStudioType: handoff.target.studioType,
    authoritativeAsset: {
      assetId: handoff.payload.assetId,
      versionId: handoff.payload.versionId,
    },
    bundledAssets: [{
      role: "primary",
      assetId: handoff.payload.assetId,
      versionId: handoff.payload.versionId,
    }],
    context: {
      initiatedAt: context.initiatedAt,
      intentKind: handoff.intent.kind,
      sourceReferences: context.sourceReferences,
      prefillKeys: [],
    },
    orchestration: {
      status: "prepared",
      targetInputKind: "composite",
      matchedContractId: "workflow-default-input",
      issueCodes: [],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("SqliteStudioHandoffRepository + query/persistence services", () => {
  it("persists and reloads handoff records with source/target/version/context linkage", async () => {
    const repository = createRepository();
    const record = createPreparedRecord("handoff:one");

    await repository.saveRecord(record);
    const loaded = await repository.getRecordByHandoffId("handoff:one");

    expect(loaded?.sourceStudioId).toBe("dataset-studio-default");
    expect(loaded?.targetStudioId).toBe("workflow-studio-default");
    expect(loaded?.authoritativeAsset.versionId).toBe("asset:dataset:v1");
    expect(loaded?.context.intentKind).toBe(StudioHandoffIntentKinds.authoringContinuation);
  });

  it("supports bounded query surfaces by source, target, and asset/version", async () => {
    const repository = createRepository();
    await repository.saveRecord(createPreparedRecord("handoff:a", "asset:dataset:v1"));
    await repository.saveRecord(createPreparedRecord("handoff:b", "asset:dataset:v2"));
    await repository.saveRecord(createPreparedRecord("handoff:c", "asset:dataset:v3"));

    const query = new StudioHandoffQueryService(repository);
    const bySource = await query.listBySourceStudio("dataset-studio-default", 2);
    const byTarget = await query.listByTargetStudio("workflow-studio-default", 2);
    const byAssetVersion = await query.listByAssetVersion("asset:dataset", "asset:dataset:v2", 2);

    expect(bySource.length).toBe(2);
    expect(byTarget.length).toBe(2);
    expect(byAssetVersion.length).toBe(1);
    expect(byAssetVersion[0]?.handoffId).toBe("handoff:b");
  });

  it("persists revision-aware chains through the persistence service", async () => {
    const repository = createRepository();
    const persistence = new StudioHandoffPersistenceService(repository);

    const base = createPreparedRecord("handoff:base", "asset:dataset:v1");
    await repository.saveRecord(base);

    const revised = await persistence.persistFailure({
      handoff: createStudioHandoffContract({
        id: "handoff:rev1",
        source: { studioId: "dataset-studio-default", studioType: "dataset-studio" },
        target: { studioId: "workflow-studio-default", studioType: "workflow-studio" },
        payload: {
          assetId: "asset:dataset",
          versionId: "asset:dataset:v2",
          taxonomy: createCompositionTaxonomyDescriptor({
            structuralKind: TaxonomyStructuralKinds.atomic,
            semanticRole: TaxonomySemanticRoles.dataset,
            behaviorKind: TaxonomyBehaviorKinds.none,
          }),
          targetInputContract: { contractId: "workflow-default-input" },
        },
        intent: { kind: StudioHandoffIntentKinds.authoringContinuation },
      }),
      context: createStudioHandoffContext({
        sourceStudioId: "dataset-studio-default",
        sourceStudioType: "dataset-studio",
        targetStudioId: "workflow-studio-default",
        targetStudioType: "workflow-studio",
        intent: { kind: StudioHandoffIntentKinds.authoringContinuation },
        sourceReferences: [{ assetId: "asset:dataset", versionId: "asset:dataset:v2" }],
      }),
      failure: {
        stage: "input-adaptation",
        code: "input-adaptation-failed",
        message: "failed",
        issues: [{ code: "compatibility-failed", message: "x" }],
      },
      revision: {
        revisionId: "rev-1",
        previousHandoffId: "handoff:base",
        updatedHandoffId: "handoff:rev1",
        createdAt: new Date().toISOString(),
      },
      changes: {
        updatedAuthoritativeAsset: true,
        updatedAuthoritativeVersion: {
          assetId: "asset:dataset",
          previousVersionId: "asset:dataset:v1",
          nextVersionId: "asset:dataset:v2",
        },
        updatedBundleAssets: [],
        updatedContextPrefillKeys: [],
        updatedContextProvenanceFields: [],
      },
    });

    expect(revised.revision?.previousHandoffId).toBe("handoff:base");

    const loaded = await repository.getRecordByHandoffId("handoff:rev1");
    expect(loaded?.revision?.revisionId).toBe("rev-1");
    expect(loaded?.orchestration.status).toBe("failed");
    expect(loaded?.authoritativeAsset.versionId).toBe("asset:dataset:v2");
  });
});
