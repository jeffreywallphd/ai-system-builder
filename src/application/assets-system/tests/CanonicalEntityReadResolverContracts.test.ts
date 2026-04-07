import { describe, expect, it } from "bun:test";
import { CanonicalEntityReadResolver } from "../CanonicalEntityReadResolver";

describe("CanonicalEntityReadResolver contract propagation", () => {
  it("returns taxonomy and contract together when contract resolver is configured", async () => {
    const resolver = new CanonicalEntityReadResolver(
      {
        resolveIdentity: async () => ({
          entityType: "workflow-definition",
          entityId: "wf-1",
          assetId: "workflow-definition:wf-1",
          latestVersionId: "wf:v1",
          taxonomy: {
            structuralKind: "composite",
            semanticRole: "workflow",
            behaviorKind: "deterministic",
          },
          updatedAt: new Date("2026-03-24T00:00:00.000Z"),
        }),
      } as any,
      {
        execute: async () => ({
          assetId: "workflow-definition:wf-1",
          name: "Workflow",
          kind: "workflow-definition",
          status: "available",
          taxonomy: {
            structuralKind: "composite",
            semanticRole: "workflow",
            behaviorKind: "deterministic",
          },
          latestVersionId: "wf:v1",
          versionCount: 1,
        }),
      } as any,
      {
        execute: async () => ({ versionId: "wf:v1" }),
      } as any,
      undefined,
      undefined,
      {
        resolveCanonicalEntityContract: async () => ({
          version: "1.0.0",
          input: { kind: "json-schema" },
          output: { kind: "json-schema" },
          parameters: [],
          execution: { invocationMode: "async", sideEffects: "bounded" },
        }),
      } as any,
    );

    const resolution = await resolver.resolve({ entityType: "workflow-definition", entityId: "wf-1" });

    expect(resolution.taxonomy?.semanticRole).toBe("workflow");
    expect(resolution.contract?.version).toBe("1.0.0");
  });

  it("keeps contract fallback explicit when contract resolver returns unavailable", async () => {
    const resolver = new CanonicalEntityReadResolver(
      {
        resolveIdentity: async () => ({
          entityType: "workflow-definition",
          entityId: "wf-1",
          assetId: "workflow-definition:wf-1",
          updatedAt: new Date("2026-03-24T00:00:00.000Z"),
        }),
      } as any,
      {
        execute: async () => ({
          assetId: "workflow-definition:wf-1",
          name: "Workflow",
          kind: "workflow-definition",
          status: "available",
          latestVersionId: "wf:v1",
          versionCount: 1,
        }),
      } as any,
      {
        execute: async () => ({ versionId: "wf:v1" }),
      } as any,
      undefined,
      undefined,
      {
        resolveCanonicalEntityContract: async () => undefined,
      } as any,
    );

    const resolution = await resolver.resolve({ entityType: "workflow-definition", entityId: "wf-1" });
    expect(resolution.preferred).toBeTrue();
    expect(resolution.contract).toBeUndefined();
  });
});
