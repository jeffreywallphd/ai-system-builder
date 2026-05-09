import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "../../../../testing/node-test";
import {
  mapAssetDefinitionDetail,
  mapAssetDefinitionListResult,
  mapAssetResourceBackedViewDetail,
  mapAssetResourceBackedViewListResult,
  mapTransportEnvelopeError,
  sanitizeAssetLibraryDiagnosticMessages,
} from "../index";
import * as assetLibraryExports from "../index";

const unsafeValues = [
  "C:\\Users\\name\\secret.txt",
  "/tmp/private/file",
  "/home/user/.cache/token",
  "/Users/name/private/file",
  "Bearer abc123",
  "apiKey=abc123",
  "signedUrl",
  "access_token",
  "token",
  "password",
  "secret",
  "auth",
  "stack trace",
  "command",
  "process.env",
  "base64",
  "data:image/png;base64,AAAA",
  "workflowJson",
  "prompt",
  "command line",
  "bytes",
  "blobs",
  "raw provider payload",
  "raw provider payloads",
  "https://example.invalid/object?X-Amz-Signature=abc",
  "https://example.invalid/object?token=abc",
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
        localPath: "/tmp/private/file",
        nested: {
          token: "Bearer abc123",
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
        purpose: "Bearer abc123",
        userFacingSummary: "safe user summary",
        developerFacingSummary: "raw provider payloads",
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

  it("maps resource-backed cards safely and labels generated/external objects as unregistered", () => {
    const result = mapAssetResourceBackedViewListResult({
      items: [
        {
          viewId: "asset-view.generated-output.internal.1",
          viewKind: "generated-output",
          assetType: "image",
          assetFamily: "resource-backed",
          displayName: "Generated output",
          metadata: {
            finalized: false,
            registered: false,
            localPath: "/tmp/private/file",
            prompt: "raw provider payloads",
          },
          diagnostics: [{ severity: "info", code: "generated-output-not-registered", message: "Generated output is not finalized or registered." }],
        },
        {
          viewId: "asset-view.external-repository-object.internal.1",
          viewKind: "external-repository-object",
          assetType: "data-source",
          assetFamily: "resource-backed",
          displayName: "External object",
          metadata: { imported: false, registered: false, token: "Bearer abc123" },
        },
      ],
    });

    expect(result.items[0]).toMatchObject({
      viewId: "asset-view.generated-output.internal.1",
      registrationStatusLabel: "Not finalized or registered",
      diagnostics: ["Generated output is not finalized or registered."],
    });
    expect(result.items[1]).toMatchObject({
      viewId: "asset-view.external-repository-object.internal.1",
      registrationStatusLabel: "Not imported or registered",
    });
    expect(JSON.stringify(result)).not.toContain("/tmp/private/file");
    expect(JSON.stringify(result)).not.toContain("Bearer abc123");
  });

  it("maps resource-backed detail without unsafe metadata, paths, bytes, or prompts", () => {
    const detail = mapAssetResourceBackedViewDetail({
      view: {
        viewId: "asset-view.generated-output.internal.1",
        viewKind: "generated-output",
        displayName: "Generated output",
        metadata: {
          safe: "visible",
          prompt: "safe looking prompt",
          negativePrompt: "safe looking negative prompt",
          workflow: { node: "safe-looking-workflow" },
          requestId: "request-123",
          taskId: "task-123",
          signedUrl: "https://example.invalid/object?X-Amz-Signature=abc",
          storageRootDirectory: "/tmp/private/file",
          bytes: "bytes",
        },
        resourceBacking: {
          resourceKind: "generated-output",
          role: "primary",
          displayName: "Generated output",
          contentType: "image/png",
          localPath: "/tmp/private/file",
        },
      },
    });

    expect(detail.metadata).toEqual({ safe: "visible" });
    expect(detail.resourceBackingSummary).toMatchObject({ resourceKind: "generated-output", contentType: "image/png" });
    expect(JSON.stringify(detail)).not.toContain("/tmp/private/file");
    expect(JSON.stringify(detail)).not.toContain("raw provider payloads");
    expect(JSON.stringify(detail)).not.toContain("safe looking prompt");
    expect(JSON.stringify(detail)).not.toContain("safe looking negative prompt");
    expect(JSON.stringify(detail)).not.toContain("safe-looking-workflow");
    expect(JSON.stringify(detail)).not.toContain("request-123");
    expect(JSON.stringify(detail)).not.toContain("task-123");
    expect(JSON.stringify(detail)).not.toContain("X-Amz-Signature");
    expect(JSON.stringify(detail)).not.toContain("bytes");
  });

  it("sanitizes resource-backed view diagnostics while preserving safe messages", () => {
    const unsafeDiagnostics = unsafeValues.map((message, index) => ({
      severity: "warning",
      code: `unsafe-${index}`,
      message,
    }));
    const result = mapAssetResourceBackedViewListResult({
      diagnostics: [
        { severity: "info", code: "safe", message: "Provider is not configured for this host." },
        ...unsafeDiagnostics,
      ],
      items: [{
        viewId: "asset-view.artifact.safe",
        viewKind: "artifact",
        displayName: "Safe artifact",
        sourceKind: "artifact-browser",
        diagnostics: [
          { severity: "info", code: "safe-card", message: "Safe descriptor-only diagnostic." },
          ...unsafeDiagnostics,
        ],
      }],
    });
    const detail = mapAssetResourceBackedViewDetail({
      view: {
        viewId: "asset-view.artifact.safe",
        viewKind: "artifact",
        displayName: "Safe artifact",
        sourceKind: "artifact-browser",
        diagnostics: [
          { severity: "info", code: "safe-detail", message: "Safe detail diagnostic." },
          ...unsafeDiagnostics,
        ],
      },
    });
    const serialized = JSON.stringify({ result, detail });

    expect(result.diagnostics).toEqual([{ severity: "info", code: "safe", message: "Provider is not configured for this host." }]);
    expect(result.items[0]?.diagnostics).toEqual(["Safe descriptor-only diagnostic."]);
    expect(detail.diagnostics).toEqual(["Safe detail diagnostic."]);
    for (const unsafe of unsafeValues) {
      expect(serialized.includes(unsafe)).toBe(false);
    }
  });

  it("sanitizes standalone diagnostic message arrays for UI rendering", () => {
    expect(sanitizeAssetLibraryDiagnosticMessages([
      "Safe descriptor-only diagnostic.",
      ...unsafeValues,
    ])).toEqual(["Safe descriptor-only diagnostic."]);

    expect(sanitizeAssetLibraryDiagnosticMessages(unsafeValues)).toEqual([]);
    expect(sanitizeAssetLibraryDiagnosticMessages(undefined)).toEqual([]);
    expect(/C:\\|\/tmp|\/home|Bearer|token|secret|password|apiKey|signedUrl|access_token|base64|data:image|raw provider payload|workflowJson|prompt|stack|command line|process\.env/i.test(JSON.stringify(sanitizeAssetLibraryDiagnosticMessages([
      "C:\\Users\\name\\file.png",
      "/tmp/generated.png",
      "/home/user/cache",
      "Bearer abc",
      "token",
      "secret",
      "password",
      "apiKey",
      "signedUrl",
      "access_token",
      "base64",
      "data:image",
      "raw provider payload",
      "workflowJson",
      "prompt",
      "stack",
      "command line",
      "process.env",
    ])))).toBe(false);
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

    const source = readFileSync(join(process.cwd(), "modules/ui/shared/asset-library/assetLibraryReadModels.ts"), "utf8");
    expect(source).not.toContain("createAssetDefinition");
    expect(source).not.toContain("seedBuiltInAssetDefinitions");
    expect(/\b(?:importAsset|finalizeAsset|registerAsset|scanResources|executeAsset)\b/.test(source)).toBe(false);
  });
});
