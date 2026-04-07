import { describe, expect, it } from "bun:test";
import { StudioHandoffClient, type StudioHandoffSdkTransport } from "../sdk";
import {
  toStudioHandoffSdkInitiateResponse,
  toStudioHandoffSdkRetryResponse,
  toStudioHandoffSdkStatusResponse,
} from "../sdk/StudioHandoffSdkMapper";
import type { PersistedStudioHandoffRecord } from "@application/studio-handoff/StudioHandoffPersistenceService";

function createRecord(): PersistedStudioHandoffRecord {
  return Object.freeze({
    handoffId: "handoff:sdk",
    sourceStudioId: "dataset-studio-default",
    sourceStudioType: "dataset-studio",
    targetStudioId: "system-studio-default",
    targetStudioType: "system-studio",
    authoritativeAsset: {
      assetId: "asset:dataset",
      versionId: "asset:dataset:v2",
    },
    bundledAssets: [
      { role: "primary", assetId: "asset:dataset", versionId: "asset:dataset:v2" },
      { role: "system-component", assetId: "system:child", versionId: "system:child:v1" },
    ],
    context: {
      intentKind: "system-integration",
      sourceReferences: [
        { assetId: "asset:dataset", versionId: "asset:dataset:v2", relation: "primary" },
        { assetId: "system:parent", versionId: "system:parent:v4", relation: "system-of-systems" },
      ],
      prefillKeys: ["title", "nestedStrategy"],
    },
    orchestration: {
      status: "prepared",
      issueCodes: [],
      matchedContractId: "system-default-input",
      targetInputKind: "system",
    },
    retryLink: {
      attemptKind: "reconciliation",
      decision: "reconcilable",
      reasonCode: "requires-reconciliation",
      reason: "Source version changed.",
      sourceHandoffId: "handoff:failed",
      targetHandoffId: "handoff:sdk",
      initiatedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

describe("Studio handoff SDK contract", () => {
  it("maps persisted handoff, route, and compatibility state into stable public SDK DTOs", () => {
    const record = createRecord();
    const route = {
      candidates: [
        {
          studioType: "system-studio",
          studioId: "system-studio-default",
          compatible: true,
          score: 42,
          reasons: [{ code: "selected-preferred-target", message: "selected" }],
          compatibility: { compatible: true, targetStudioType: "system-studio", issues: [] },
        },
      ],
      compatibleCandidates: [],
      alternateCandidates: [],
      reasons: [],
      deterministicSignature: "signature-1",
      preferred: {
        studioType: "system-studio",
        studioId: "system-studio-default",
        compatible: true,
        score: 42,
        reasons: [{ code: "selected-preferred-target", message: "selected" }],
        compatibility: { compatible: true, targetStudioType: "system-studio", issues: [] },
      },
    };

    const initiated = toStudioHandoffSdkInitiateResponse({
      record,
      routeDecision: route,
      compatibility: {
        compatible: true,
        targetStudioType: "system-studio",
        matchedContractId: "system-default-input",
        issues: [],
      },
    });
    const status = toStudioHandoffSdkStatusResponse({ record, routeDecision: route });
    const retried = toStudioHandoffSdkRetryResponse({
      record,
      routeDecision: route,
      decision: {
        decision: "reconcilable",
        reasonCode: "requires-reconciliation",
        reason: "Source version changed.",
      },
    });

    expect(initiated.handoff.authoritativeAsset.versionId).toBe("asset:dataset:v2");
    expect(initiated.handoff.routeDecision?.preferredTarget?.studioType).toBe("system-studio");
    expect(initiated.handoff.retryLink?.attemptKind).toBe("reconciliation");
    expect(status.handoff?.bundledAssets).toHaveLength(2);
    expect(retried.retryDecision.decision).toBe("reconcilable");
  });

  it("keeps the SDK client boundary transport-thin with overrideable auth/access context", async () => {
    const calls: Array<{ context: unknown }> = [];
    const transport: StudioHandoffSdkTransport = {
      async initiateHandoff(_, context) {
        calls.push({ context });
        return Object.freeze({
          ok: true,
          data: {
            handoff: {
              handoffId: "handoff:sdk",
              status: "prepared",
              sourceStudio: { studioId: "s1", studioType: "dataset-studio" },
              targetStudio: { studioId: "s2", studioType: "workflow-studio" },
              authoritativeAsset: { assetId: "asset:dataset", versionId: "asset:dataset:v1" },
              bundledAssets: [{ assetId: "asset:dataset", versionId: "asset:dataset:v1" }],
              issueCodes: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            result: {
              accepted: true,
              compatibility: { compatible: true, issues: [] },
            },
          },
        });
      },
      async getHandoffStatus() { throw new Error("unused"); },
      async retryHandoff() { throw new Error("unused"); },
      async reconcileHandoff() { throw new Error("unused"); },
    };

    const client = new StudioHandoffClient({
      transport,
      authentication: { bearerToken: "default-token" },
      accessContext: { callerKind: "user", callerId: "u1" },
    });

    const response = await client.initiateHandoff(
      {
        source: { studioId: "s1", studioType: "dataset-studio" },
        sourceOutput: {
          authoritativeAsset: {
            assetId: "asset:dataset",
            versionId: "asset:dataset:v1",
            taxonomy: { structuralKind: "atomic", semanticRole: "dataset", behaviorKind: "none" },
          },
        },
        intent: { kind: "authoring-continuation" },
      },
      {
        authentication: { bearerToken: "override-token" },
        accessContext: { callerKind: "service", callerId: "svc-1" },
      },
    );

    expect(response.ok).toBeTrue();
    expect(calls[0]?.context).toEqual({
      authentication: { bearerToken: "override-token" },
      accessContext: { callerKind: "service", callerId: "svc-1" },
    });
  });
});

