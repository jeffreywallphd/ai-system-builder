import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "../../../../testing/node-test";
import {
  ASSET_LIBRARY_DEFERRED_QUERY_FIELDS,
  mapAssetDefinitionDetail,
  mapAssetDefinitionListResult,
  mapTransportEnvelopeError,
} from "../index";
import * as assetLibraryExports from "../index";

const unsafeValues = [
  "/tmp/secret",
  "/home/user/private",
  "C:\\Users\\name\\secret",
  "Bearer abc",
  "apiKey",
  "token",
  "password",
  "secret",
  "auth",
  "stack",
  "stack trace",
  "command",
  "process.env",
  "base64",
  "data:image/png;base64,AAAA",
  "blob",
  "raw provider payload-like text",
];

function detailPayload(overrides: Record<string, unknown> = {}) {
  return {
    builtIn: true,
    definition: {
      definitionId: "builtin.document",
      version: "1.0.0",
      assetType: "document",
      assetFamily: "resource-backed",
      displayName: "Document",
      description: "Reusable document descriptor",
      lifecycleStatus: "published",
      reviewStatus: "approved",
      provenance: {
        sourceKind: "system-generated",
        authorship: "human-authored",
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-02T00:00:00.000Z",
        redactedGenerationSummary: "safe generation summary",
      },
      aiContext: {
        purpose: "Represent document-backed assets",
        userFacingSummary: "Document asset",
        developerFacingSummary: "Maps document resources",
        capabilities: [{ summary: "Reads descriptors" }],
        limitations: [{ summary: "No byte reads" }],
        safetyNotes: [{ summary: "Metadata only" }],
      },
      configurationSchema: {
        schemaId: "document.schema",
        schemaVersion: "1",
        fields: [{ fieldId: "title", valueKind: "string" }],
        requiredFieldIds: ["title"],
        strict: true,
      },
      ports: [
        { portId: "in", direction: "input" },
        { portId: "out", direction: "output" },
      ],
      requirements: [
        {
          requirementKind: "runtime-capability",
          required: true,
          runtimeCapabilityId: "python-runtime",
          safetyStatus: "requires-review",
        },
      ],
      metadata: {
        safe: "visible",
        localPath: "/tmp/secret",
        nested: {
          token: "Bearer abc",
          note: "safe nested note",
        },
      },
      ...overrides,
    },
    validationSummary: {
      status: "valid-with-warnings",
      issues: [{ severity: "warning", category: "ai-context", message: "Safe warning" }],
      validatedAt: "2026-05-03T00:00:00.000Z",
    },
  };
}

describe("asset library mappers", () => {
  it("maps definition list cards into safe UI-facing cards and preserves built-in distinction", () => {
    const result = mapAssetDefinitionListResult({
      items: [
        {
          definitionRef: { kind: "asset-definition", id: "builtin.document", version: "1.0.0" },
          definitionId: "builtin.document",
          version: "1.0.0",
          assetType: "document",
          assetFamily: "resource-backed",
          displayName: "Document",
          summary: "Metadata-only document asset",
          lifecycleStatus: "published",
          builtIn: true,
          provenance: { updatedAt: "2026-05-02T00:00:00.000Z" },
          metadata: { localPath: "/tmp/secret" },
        },
        {
          definitionId: "custom.tool",
          version: "2.0.0",
          assetType: "tool",
          assetFamily: "behavioral",
          displayName: "Custom Tool",
          lifecycleStatus: "draft",
          builtIn: false,
        },
      ],
      nextCursor: "cursor-2",
    });

    expect(result.items).toEqual([
      {
        id: "builtin.document@1.0.0",
        definitionId: "builtin.document",
        definitionRef: { kind: "asset-definition", id: "builtin.document", version: "1.0.0" },
        version: "1.0.0",
        displayName: "Document",
        summary: "Metadata-only document asset",
        assetType: "document",
        assetTypeLabel: "Document",
        assetFamily: "resource-backed",
        assetFamilyLabel: "Resource Backed",
        lifecycleStatus: "published",
        lifecycleStatusLabel: "Published",
        builtIn: true,
        updatedAt: "2026-05-02T00:00:00.000Z",
        badges: ["Built-in", "Published"],
      },
      {
        id: "custom.tool@2.0.0",
        definitionId: "custom.tool",
        definitionRef: undefined,
        version: "2.0.0",
        displayName: "Custom Tool",
        summary: undefined,
        assetType: "tool",
        assetTypeLabel: "Tool",
        assetFamily: "behavioral",
        assetFamilyLabel: "Behavioral",
        lifecycleStatus: "draft",
        lifecycleStatusLabel: "Draft",
        builtIn: false,
        updatedAt: undefined,
        badges: ["Draft"],
      },
    ]);
    expect(result.nextCursor).toBe("cursor-2");
  });

  it("handles empty lists", () => {
    expect(mapAssetDefinitionListResult({ items: [] })).toEqual({
      items: [],
      diagnostics: [],
    });
  });

  it("maps details with optional expanded sections", () => {
    const detail = mapAssetDefinitionDetail(detailPayload());

    expect(detail.id).toBe("builtin.document@1.0.0");
    expect(detail.overview?.reviewStatus).toBe("approved");
    expect(detail.aiContextSummary?.capabilityCount).toBe(1);
    expect(detail.configurationSummary?.fieldCount).toBe(1);
    expect(detail.portsSummary?.inputCount).toBe(1);
    expect(detail.requirementsSummary?.runtimeCapabilityIds).toEqual(["python-runtime"]);
    expect(detail.provenanceSummary?.updatedAt).toBe("2026-05-02T00:00:00.000Z");
    expect(detail.validationSummary).toMatchObject({
      status: "valid-with-warnings",
      issueCount: 1,
      warningCount: 1,
    });
    expect(detail.metadata).toEqual({ safe: "visible", nested: { note: "safe nested note" } });
  });

  it("drops or redacts unsafe metadata and details", () => {
    const mapped = mapAssetDefinitionDetail(detailPayload({
      description: "/home/user/private",
      aiContext: {
        purpose: "Bearer abc",
        userFacingSummary: "safe user summary",
        developerFacingSummary: "raw provider payload-like text",
      },
      provenance: {
        sourceKind: "system-generated",
        redactedGenerationSummary: "command",
      },
      metadata: Object.fromEntries(unsafeValues.map((value, index) => [`unsafe${index}`, value])),
    }));
    const serialized = JSON.stringify(mapped);

    for (const unsafe of unsafeValues) {
      expect(serialized.includes(unsafe)).toBe(false);
    }
    expect(mapped.overview?.description).toBeUndefined();
    expect(mapped.aiContextSummary?.purpose).toBeUndefined();
    expect(mapped.provenanceSummary?.redactedGenerationSummary).toBeUndefined();
  });

  it("does not require validation by default", () => {
    const mapped = mapAssetDefinitionDetail({
      definition: detailPayload({}).definition,
      builtIn: false,
    });

    expect(mapped.validationSummary).toBeUndefined();
  });

  it("does not convert invalid canonical values into valid-looking asset semantics", () => {
    const result = mapAssetDefinitionListResult({
      items: [
        {
          definitionId: "broken.asset",
          version: "1.0.0",
          assetType: "definitely-not-tool",
          assetFamily: "definitely-not-behavioral",
          lifecycleStatus: "definitely-not-draft",
          displayName: "Broken asset",
        },
        {
          definitionId: "missing.asset",
          version: "1.0.0",
          displayName: "Missing asset",
        },
      ],
    });

    expect(result.items[0]).toMatchObject({
      assetType: undefined,
      assetTypeLabel: "Unknown type",
      assetFamily: undefined,
      assetFamilyLabel: "Unknown family",
      lifecycleStatus: undefined,
      lifecycleStatusLabel: "Unknown status",
      badges: undefined,
    });
    expect(result.items[1]).toMatchObject({
      assetType: undefined,
      assetTypeLabel: "Unknown type",
      assetFamily: undefined,
      assetFamilyLabel: "Unknown family",
      lifecycleStatus: undefined,
      lifecycleStatusLabel: "Unknown status",
    });
  });

  it("normalizes safe client errors without exposing internal detail", () => {
    const error = mapTransportEnvelopeError({
      ok: false,
      requestId: "req-1",
      correlationId: "corr-1",
      error: {
        code: "internal",
        message: "failed at /tmp/secret with stack",
        details: {
          fieldIssues: [{ field: "definitionId", message: "Bearer abc" }],
        },
      },
    }, { status: 500 });

    expect(error).toEqual({
      code: "internal",
      message: "Unable to read Asset Library data.",
      requestId: "req-1",
      correlationId: "corr-1",
      status: 500,
    });
  });

  it("does not export unsupported operation helpers", () => {
    const forbiddenExports = [
      "createAssetDefinition",
      "updateAssetDefinition",
      "deleteAssetDefinition",
      "seedBuiltInAssetDefinitions",
      "importAsset",
      "finalizeAsset",
      "scanResources",
      "executeAsset",
    ];

    for (const exportName of forbiddenExports) {
      expect((assetLibraryExports as Record<string, unknown>)[exportName]).toBeUndefined();
    }
    expect([...ASSET_LIBRARY_DEFERRED_QUERY_FIELDS]).toContain("execute");

    const source = readFileSync(join(process.cwd(), "modules/ui/shared/asset-library/assetLibraryReadModels.ts"), "utf8");
    expect(source).not.toContain("createAssetDefinition");
    expect(source).not.toContain("seedBuiltInAssetDefinitions");
  });
});
