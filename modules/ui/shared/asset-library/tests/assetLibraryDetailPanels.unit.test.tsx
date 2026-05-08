import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "../../../../testing/node-test";
import {
  AssetLibraryDefinitionDetailView,
  AssetLibraryDetailRow,
  buildAssetLibraryAdvancedSections,
  formatAssetLibraryBoolean,
  formatAssetLibraryDate,
  formatAssetLibraryLabel,
  getAssetLibraryAdvancedSections,
  mapAssetDefinitionDetail,
  type AssetLibraryDefinitionDetail,
} from "../index";

const baseDetail: AssetLibraryDefinitionDetail = {
  id: "builtin.document@1.0.0",
  definitionId: "builtin.document",
  version: "1.0.0",
  displayName: "Document",
  summary: "Document building block",
  assetType: "document",
  assetFamily: "resource-backed",
  lifecycleStatus: "published",
  builtIn: true,
};

const advancedDetail: AssetLibraryDefinitionDetail = {
  ...baseDetail,
  overview: {
    description: "Reusable document descriptor",
    reviewStatus: "approved",
  },
  aiContextSummary: {
    purpose: "Represent document-backed assets",
    userFacingSummary: "Document asset",
    developerFacingSummary: "Maps document resources",
    capabilityCount: 1,
    limitationCount: 1,
    safetyNoteCount: 1,
  },
  configurationSummary: {
    schemaId: "document.schema",
    schemaVersion: "1",
    fieldCount: 2,
    requiredFieldCount: 1,
    strict: true,
    description: "Small configuration surface",
  },
  portsSummary: {
    totalCount: 2,
    inputCount: 1,
    outputCount: 1,
    eventCount: 0,
    controlCount: 0,
  },
  requirementsSummary: {
    totalCount: 1,
    requiredCount: 1,
    runtimeCapabilityIds: ["python-runtime"],
    hostKinds: ["desktop"],
    safetyStatuses: ["safe"],
  },
  provenanceSummary: {
    sourceKind: "system-generated",
    authorship: "human-authored",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
  },
  metadata: {
    safeNote: "safe nested note",
  },
};

describe("asset library shared detail panels", () => {
  it("detail rows render fallback text for missing values", () => {
    const markup = renderToStaticMarkup(<dl><AssetLibraryDetailRow label="Schema ID" value={undefined} /></dl>);

    expect(markup).toContain("Schema ID");
    expect(markup).toContain("Not specified");
  });

  it("formats labels, dates, and booleans safely", () => {
    expect(formatAssetLibraryLabel("resource-backed")).toBe("Resource Backed");
    expect(formatAssetLibraryLabel(undefined)).toBe("Not specified");
    expect(formatAssetLibraryBoolean(false)).toBe("No");
    expect(formatAssetLibraryDate("not a date")).toBeUndefined();
  });

  it("builds only available advanced sections", () => {
    expect(buildAssetLibraryAdvancedSections(baseDetail).map((section) => section.key)).toEqual([]);
    expect(getAssetLibraryAdvancedSections(advancedDetail)).toEqual([
      "aiContext",
      "configuration",
      "ports",
      "requirements",
      "provenance",
      "metadata",
    ]);
  });

  it("renders advanced sections collapsed by default", () => {
    const markup = renderToStaticMarkup(
      <AssetLibraryDefinitionDetailView
        detail={advancedDetail}
        isLoading={false}
        isLoadingValidation={false}
        onLoadValidationDetails={() => undefined}
      />,
    );

    expect(markup).toContain("AI-readable context");
    expect(markup).toContain("aria-expanded=\"false\"");
    expect(markup).toContain("hidden=\"\"");
  });

  it("does not render fake validation success or zero issue state when validation is absent", () => {
    const markup = renderToStaticMarkup(
      <AssetLibraryDefinitionDetailView
        detail={advancedDetail}
        isLoading={false}
        isLoadingValidation={false}
        onLoadValidationDetails={() => undefined}
      />,
    );

    expect(markup).toContain("Validation details are loaded only when requested.");
    expect(markup).not.toContain("Valid With Warnings");
    expect(markup).not.toContain("Issues</dt><dd>0</dd>");
  });

  it("renders the safe metadata note when metadata is present", () => {
    const markup = renderToStaticMarkup(
      <AssetLibraryDefinitionDetailView
        detail={advancedDetail}
        isLoading={false}
        isLoadingValidation={false}
        onLoadValidationDetails={() => undefined}
      />,
    );

    expect(markup).toContain("Sensitive or unsafe metadata is omitted");
    expect(markup).toContain("safe nested note");
  });

  it("does not render unsafe metadata values after shared mapping", () => {
    const detail = mapAssetDefinitionDetail({
      definition: {
        definitionId: "custom.asset",
        version: "1.0.0",
        displayName: "Custom asset",
        metadata: {
          safeNote: "visible",
          localPath: "C:\\Users\\name\\secret",
          token: "Bearer abc",
        },
      },
    });
    const markup = renderToStaticMarkup(
      <AssetLibraryDefinitionDetailView
        detail={detail}
        isLoading={false}
        isLoadingValidation={false}
        onLoadValidationDetails={() => undefined}
      />,
    );

    expect(markup).toContain("visible");
    expect(markup).not.toContain("C:\\Users\\name\\secret");
    expect(markup).not.toContain("Bearer abc");
  });
});
