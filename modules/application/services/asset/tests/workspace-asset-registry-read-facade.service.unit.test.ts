import test from "node:test";
import assert from "node:assert/strict";

import type { AssetReference } from "../../../../contracts/asset";
import type { WorkspaceId, WorkspaceRecord, WorkspaceSystemPackActivation } from "../../../../contracts/workspace";
import { createWorkspaceId } from "../../../../contracts/workspace";
import type { AssetRegistryDefinitionReadPort } from "../../../ports/asset";
import type { WorkspaceRepository, WorkspaceSystemPackActivationRepository } from "../../../ports/workspace";
import { ListWorkspaceSystemPackActivationsUseCase } from "../../../use-cases/workspace";
import { SYSTEM_FOUNDATION_PACK_ID, SYSTEM_FOUNDATION_PACK_VERSION } from "../../asset-packs/system-packs/system-foundation-pack.constants";
import { WorkspaceAssetRegistryReadFacade, WorkspaceAssetRegistryReadFacadeError } from "../workspace-asset-registry-read-facade.service";
import type { AssetDefinitionCard, AssetDefinitionDetail, AssetRegistryListQuery } from "../asset-registry-read-facade.types";

const workspaceA = createWorkspaceId("workspace-a");
const workspaceB = createWorkspaceId("workspace-b");
const archivedWorkspace = createWorkspaceId("workspace-archived");
const foundationRef: AssetReference = { kind: "asset-definition", id: "system.foundation.button", version: "1.0.0" } as AssetReference;

class FakeReadPort implements AssetRegistryDefinitionReadPort {
  public listCalls: AssetRegistryListQuery[] = [];
  public detailCalls: AssetReference[] = [];
  public cards: AssetDefinitionCard[] = [foundationCard(), bareSourcePackCard(), wrongTrustCard(), customCard()];

  async listDefinitionCards(query: AssetRegistryListQuery = {}) {
    this.listCalls.push(query);
    return { items: this.cards };
  }

  async readDefinitionDetail(ref: AssetReference): Promise<AssetDefinitionDetail | undefined> {
    this.detailCalls.push(ref);
    if (String(ref.id) !== foundationRef.id) return undefined;
    return {
      definition: {
        definitionId: foundationRef.id,
        version: "1.0.0",
        assetType: "ui-component",
        assetFamily: "primitive",
        displayName: "Foundation Button",
        description: "A system foundation button.",
        lifecycleStatus: "stable",
        provenance: { sourceKind: "system-generated" },
        metadata: { sourcePackId: SYSTEM_FOUNDATION_PACK_ID, sourcePackVersion: SYSTEM_FOUNDATION_PACK_VERSION, sourceKind: "system", sourceLayer: "system-default", trustStatus: "system-trusted", systemDefault: true },
      },
    } as AssetDefinitionDetail;
  }

  async listResourceBackedViewCards() {
    return { items: [{ id: "global", viewId: "global", displayName: "Global leak", registrationStatusLabel: "Registered" }] } as never;
  }

  async readResourceBackedViewDetail() {
    return { view: { viewId: "global", viewKind: "artifact" } } as never;
  }
}

class FakeWorkspaceRepo implements WorkspaceRepository {
  public records = new Map<WorkspaceId, WorkspaceRecord>([
    [workspaceA, workspaceRecord(workspaceA, "Workspace A", "active")],
    [workspaceB, workspaceRecord(workspaceB, "Workspace B", "active")],
    [archivedWorkspace, workspaceRecord(archivedWorkspace, "Archived", "archived")],
  ]);
  async listWorkspaces() { return [...this.records.values()]; }
  async readWorkspace(workspaceId: WorkspaceId) { return this.records.get(workspaceId); }
  async saveWorkspace(workspace: WorkspaceRecord) { this.records.set(workspace.workspaceId, workspace); }
  async updateWorkspace(workspace: WorkspaceRecord) { this.records.set(workspace.workspaceId, workspace); }
  async archiveWorkspace(workspaceId: WorkspaceId) { return this.records.get(workspaceId); }
}

class FakeActivationRepo implements WorkspaceSystemPackActivationRepository {
  public activations = new Map<WorkspaceId, WorkspaceSystemPackActivation[]>();
  async listWorkspaceSystemPackActivations(workspaceId: WorkspaceId) { return this.activations.get(workspaceId) ?? []; }
  async readWorkspaceSystemPackActivation(workspaceId: WorkspaceId, activationId: string) { return (this.activations.get(workspaceId) ?? []).find((item) => item.activationId === activationId); }
  async saveWorkspaceSystemPackActivation(activation: WorkspaceSystemPackActivation) { this.activations.set(activation.workspaceId, [...(this.activations.get(activation.workspaceId) ?? []), activation]); }
  async updateWorkspaceSystemPackActivation(activation: WorkspaceSystemPackActivation) { await this.saveWorkspaceSystemPackActivation(activation); }
}

test("Workspace A with active system.foundation@1.0.0 sees strict foundation cards", async () => {
  const { facade, activations } = setup();
  activations.activations.set(workspaceA, [activation(workspaceA, "active")]);
  const result = await facade.listDefinitionCards({ workspaceId: workspaceA });
  assert.deepEqual(result.items.map((item) => item.definitionId), [foundationRef.id]);
});

test("Workspace B without activation does not see foundation cards", async () => {
  const { facade } = setup();
  const result = await facade.listDefinitionCards({ workspaceId: workspaceB });
  assert.equal(result.items.length, 0);
});

test("inactive, failed, and unknown activations exclude assets with safe diagnostics", async () => {
  for (const status of ["inactive", "failed"] as const) {
    const { facade, activations } = setup();
    activations.activations.set(workspaceA, [activation(workspaceA, status)]);
    const result = await facade.listDefinitionCards({ workspaceId: workspaceA });
    assert.equal(result.items.length, 0);
    assert.match(result.diagnostics?.map((entry) => entry.code).join(" ") ?? "", new RegExp(status));
  }

  const { facade, activations } = setup();
  activations.activations.set(workspaceA, [{ ...activation(workspaceA, "active"), packId: "system.unknown" as never }]);
  const result = await facade.listDefinitionCards({ workspaceId: workspaceA });
  assert.equal(result.items.length, 0);
  assert.equal(result.diagnostics?.some((entry) => entry.code === "workspace-system-pack-activation-unknown-pack"), true);
  assert.equal(JSON.stringify(result).includes("/"), false);
});

test("wrong source or trust metadata and bare sourcePackId do not prove system authority", async () => {
  const { facade, activations } = setup();
  activations.activations.set(workspaceA, [activation(workspaceA, "active")]);
  const result = await facade.listDefinitionCards({ workspaceId: workspaceA });
  assert.equal(result.items.some((item) => item.definitionId === "bare.foundation"), false);
  assert.equal(result.items.some((item) => item.definitionId === "wrong.trust"), false);
});

test("missing, invalid, unknown, and archived workspace fail safely without global fallback", async () => {
  const { facade, readPort } = setup();
  await assertWorkspaceError(() => facade.listDefinitionCards(), "workspace-required");
  await assertWorkspaceError(() => facade.listDefinitionCards({ workspaceId: "../unsafe" }), "workspace-invalid");
  await assertWorkspaceError(() => facade.listDefinitionCards({ workspaceId: "missing-workspace" }), "workspace-not-found");
  await assertWorkspaceError(() => facade.listDefinitionCards({ workspaceId: archivedWorkspace }), "workspace-unavailable");
  assert.equal(readPort.listCalls.length, 0);
});

test("detail reads enforce effective view membership and cannot bypass missing activation", async () => {
  const { facade, activations } = setup();
  await assert.rejects(() => facade.readDefinitionDetail(foundationRef, { workspaceId: workspaceB }), (error) => {
    assert.equal((error as WorkspaceAssetRegistryReadFacadeError).code, "workspace-asset-not-in-effective-view");
    return true;
  });
  activations.activations.set(workspaceA, [activation(workspaceA, "active")]);
  const detail = await facade.readDefinitionDetail(foundationRef, { workspaceId: workspaceA });
  assert.equal(detail?.definition.displayName, "Foundation Button");
});


test("detail membership is deterministic for effective assets beyond arbitrary list pages", async () => {
  const { facade, activations, readPort } = setup();
  activations.activations.set(workspaceA, [activation(workspaceA, "active")]);
  readPort.cards = Array.from({ length: 300 }, (_, index) => ({ ...customCard(), definitionId: `custom.global.${index}`, displayName: `Custom ${index}` }));
  const detail = await facade.readDefinitionDetail(foundationRef, { workspaceId: workspaceA });
  assert.equal(detail?.definition.displayName, "Foundation Button");
  assert.equal(readPort.listCalls.some((query) => query.limit === 250), false);
});

test("resource-backed descriptors are deferred and do not leak global records", async () => {
  const { facade, activations } = setup();
  activations.activations.set(workspaceA, [activation(workspaceA, "active")]);
  const list = await facade.listResourceBackedViewCards({ workspaceId: workspaceA });
  assert.equal(list.items.length, 0);
  assert.equal(list.diagnostics?.[0]?.code, "workspace-resource-backed-view-deferred");
  await assert.rejects(() => facade.readResourceBackedViewDetail("global", { workspaceId: workspaceA }), /deferred/);
});

test("results are deterministic and diagnostics are sanitized", async () => {
  const { facade, activations } = setup();
  activations.activations.set(workspaceA, [activation(workspaceA, "active")]);
  const first = await facade.listDefinitionCards({ workspaceId: workspaceA });
  const second = await facade.listDefinitionCards({ workspaceId: workspaceA });
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first).includes("/tmp"), false);
});

async function assertWorkspaceError(action: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(action, (error) => {
    assert.equal((error as WorkspaceAssetRegistryReadFacadeError).code, code);
    return true;
  });
}

function setup() {
  const readPort = new FakeReadPort();
  const activations = new FakeActivationRepo();
  const facade = new WorkspaceAssetRegistryReadFacade({
    assetRegistryRead: readPort,
    listWorkspaceSystemPackActivations: new ListWorkspaceSystemPackActivationsUseCase({ systemPackActivationRepository: activations }),
    workspaceRepository: new FakeWorkspaceRepo(),
  });
  return { facade, activations, readPort };
}

function foundationCard(): AssetDefinitionCard {
  return {
    definitionRef: foundationRef,
    definitionId: foundationRef.id,
    version: "1.0.0",
    assetType: "ui-component",
    assetFamily: "primitive",
    displayName: "Foundation Button",
    lifecycleStatus: "stable",
    builtIn: true,
    sourcePackId: SYSTEM_FOUNDATION_PACK_ID,
    sourcePackVersion: SYSTEM_FOUNDATION_PACK_VERSION,
    sourceKind: "system",
    sourceLayer: "system-default",
    trustStatus: "system-trusted",
    systemDefault: true,
  } as AssetDefinitionCard;
}

function bareSourcePackCard(): AssetDefinitionCard {
  return { ...foundationCard(), definitionId: "bare.foundation", displayName: "Bare", sourceKind: undefined, sourceLayer: undefined, trustStatus: undefined, systemDefault: undefined };
}

function wrongTrustCard(): AssetDefinitionCard {
  return { ...foundationCard(), definitionId: "wrong.trust", displayName: "Wrong", trustStatus: "unverified" };
}

function customCard(): AssetDefinitionCard {
  return { ...foundationCard(), definitionId: "custom.global", displayName: "Custom", sourcePackId: undefined, sourcePackVersion: undefined, sourceKind: undefined, sourceLayer: undefined, trustStatus: undefined, systemDefault: undefined, builtIn: false };
}

function activation(workspaceId: WorkspaceId, status: "active" | "inactive" | "failed"): WorkspaceSystemPackActivation {
  return {
    activationId: `activation.${workspaceId}.${status}`,
    workspaceId,
    packId: SYSTEM_FOUNDATION_PACK_ID,
    packVersion: SYSTEM_FOUNDATION_PACK_VERSION,
    sourceKind: "system",
    sourceLayer: "system-default",
    trustStatus: "system-trusted",
    status,
    activatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function workspaceRecord(workspaceId: WorkspaceId, displayName: string, status: WorkspaceRecord["status"]): WorkspaceRecord {
  return {
    workspaceId,
    displayName,
    status,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}
