import { describe, expect, it } from "../../../../testing/node-test";
import {
  ASSET_LIBRARY_DEFAULT_FILTERS,
  ASSET_LIBRARY_DETAIL_EXPANSIONS,
  assetLibraryFiltersAreActive,
  createAssetLibraryQuery,
  formatAssetLibraryBoolean,
  formatAssetLibraryDate,
  formatAssetLibraryLabel,
  getAssetLibraryAdvancedSections,
} from "../index";

describe("asset library browser helpers", () => {
  it("builds definition queries from active filters only", () => {
    expect(createAssetLibraryQuery(ASSET_LIBRARY_DEFAULT_FILTERS)).toEqual({ limit: 50 });
    expect(createAssetLibraryQuery({
      searchText: "  document  ",
      assetType: "document",
      assetFamily: "resource-backed",
      lifecycleStatus: "published",
      builtIn: "built-in",
    })).toEqual({
      limit: 50,
      searchText: "document",
      assetTypes: ["document"],
      assetFamilies: ["resource-backed"],
      lifecycleStatuses: ["published"],
      builtIn: "built-in",
    });
    expect(createAssetLibraryQuery({
      searchText: "",
      assetType: "not-a-real-type",
      assetFamily: "not-a-real-family",
      lifecycleStatus: "not-a-real-status",
      builtIn: "all",
    })).toEqual({ limit: 50 });
  });

  it("detects active filters", () => {
    expect(assetLibraryFiltersAreActive(ASSET_LIBRARY_DEFAULT_FILTERS)).toBe(false);
    expect(assetLibraryFiltersAreActive({ ...ASSET_LIBRARY_DEFAULT_FILTERS, searchText: "asset" })).toBe(true);
    expect(assetLibraryFiltersAreActive({ ...ASSET_LIBRARY_DEFAULT_FILTERS, builtIn: "custom" })).toBe(true);
  });

  it("reports advanced section availability without expanding validation by default", () => {
    expect([...ASSET_LIBRARY_DETAIL_EXPANSIONS]).toEqual([
      "aiContext",
      "configurationSchema",
      "ports",
      "requirements",
      "provenance",
      "metadata",
    ]);
    expect(getAssetLibraryAdvancedSections(undefined)).toEqual([]);
    expect(getAssetLibraryAdvancedSections({
      id: "asset@1.0.0",
      definitionId: "asset",
      version: "1.0.0",
      displayName: "Asset",
      assetType: "tool",
      assetFamily: "behavioral",
      lifecycleStatus: "draft",
      builtIn: false,
      aiContextSummary: { capabilityCount: 0, limitationCount: 0, safetyNoteCount: 0 },
      validationSummary: { issueCount: 0, errorCount: 0, warningCount: 0, status: "valid" },
    })).toEqual(["aiContext", "validation"]);
  });

  it("formats labels, booleans, and safe dates for shared presentation", () => {
    expect(formatAssetLibraryLabel("resource-backed")).toBe("Resource Backed");
    expect(formatAssetLibraryLabel(undefined)).toBe("Not specified");
    expect(formatAssetLibraryBoolean(true)).toBe("Yes");
    expect(formatAssetLibraryBoolean(undefined)).toBe("Not specified");
    expect(formatAssetLibraryDate("not a date")).toBeUndefined();
  });
});
