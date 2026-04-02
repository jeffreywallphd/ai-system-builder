import { describe, expect, it } from "bun:test";
import { createDefaultStudioAssetRegistry, StudioAssetRegistrationCategories } from "../StudioAssetRegistry";
import { listStudioAssetLibraryFilters, listStudioAssetLibrarySections } from "../StudioAssetLibrary";
import {
  insertStudioAssetIntoCompositionTree,
  StudioAssetInsertionFailureKinds,
  resolveDefaultInsertionTarget,
} from "../StudioAssetInsertion";

describe("StudioAssetLibraryAndInsertion", () => {
  it("lists registered assets in taxonomy-aligned library sections", () => {
    const registry = createDefaultStudioAssetRegistry();
    const sections = listStudioAssetLibrarySections({ registry });

    expect(sections.map((entry) => entry.category)).toEqual([
      StudioAssetRegistrationCategories.atomicUi,
      StudioAssetRegistrationCategories.composedUi,
      StudioAssetRegistrationCategories.systemPage,
    ]);
    expect(sections[0]?.entries.some((entry) => entry.id === "ui-primitive:viewer")).toBeTrue();
    expect(sections[1]?.entries.some((entry) => entry.id === "workflow-studio")).toBeTrue();
    expect(sections[2]?.entries.map((entry) => entry.id)).toContain("system-studio");
  });

  it("filters library results by search text across metadata fields", () => {
    const registry = createDefaultStudioAssetRegistry();
    const sections = listStudioAssetLibrarySections({
      registry,
      query: {
        searchText: "workflow",
      },
    });

    const matchedIds = sections.flatMap((section) => section.entries.map((entry) => entry.id));
    expect(matchedIds).toContain("workflow-studio");
    expect(matchedIds).not.toContain("dataset-studio");
  });

  it("filters library results by group, tag, and contract category", () => {
    const registry = createDefaultStudioAssetRegistry();
    const sections = listStudioAssetLibrarySections({
      registry,
      query: {
        groups: Object.freeze(["studio-surfaces"]),
        tags: Object.freeze(["workflow"]),
        contractCategories: Object.freeze(["composed-ui"]),
      },
    });

    const matchedIds = sections.flatMap((section) => section.entries.map((entry) => entry.id));
    expect(matchedIds).toEqual(["workflow-studio"]);
  });

  it("lists reusable filter options from current registry metadata", () => {
    const registry = createDefaultStudioAssetRegistry();
    const filters = listStudioAssetLibraryFilters({ registry });

    expect(filters.groups.some((option) => option.value === "studio-surfaces")).toBeTrue();
    expect(filters.contractCategories.some((option) => option.value === "composed-ui")).toBeTrue();
    expect(filters.tags.some((option) => option.value === "workflow")).toBeTrue();
  });

  it("inserts an asset instance through container placement rules and validates the composition", () => {
    const registry = createDefaultStudioAssetRegistry();
    const root = Object.freeze({
      nodeId: "root-workflow",
      assetId: "workflow-studio",
      assetVersion: "1.0.0",
    });

    const target = resolveDefaultInsertionTarget({
      registry,
      root,
      parentNodeId: "root-workflow",
    });

    expect(target).toBeDefined();

    const inserted = insertStudioAssetIntoCompositionTree({
      registry,
      request: {
        root,
        assetId: "ui-primitive:viewer",
        target: target!,
      },
    });

    expect(inserted.ok).toBeTrue();
    if (inserted.ok) {
      expect(inserted.root.slots?.find((placement) => placement.placementId === "main")?.children.length).toBe(1);
      expect(inserted.insertedNode.assetVersion).toBe("1.0.0");
    }
  });

  it("returns structured failure when insertion violates slot cardinality", () => {
    const registry = createDefaultStudioAssetRegistry();
    const root = Object.freeze({
      nodeId: "root-workflow",
      assetId: "workflow-studio",
      assetVersion: "1.0.0",
      slots: Object.freeze([
        Object.freeze({
          placementId: "main",
          children: Object.freeze([
            Object.freeze({ nodeId: "existing", assetId: "ui-primitive:viewer", assetVersion: "1.0.0" }),
          ]),
        }),
      ]),
    });

    const invalid = insertStudioAssetIntoCompositionTree({
      registry,
      request: {
        root,
        assetId: "ui-primitive:text-input",
        target: Object.freeze({
          parentNodeId: "root-workflow",
          placementKind: "slot",
          placementId: "main",
        }),
      },
    });

    expect(invalid.ok).toBeFalse();
    if (!invalid.ok) {
      expect(invalid.kind).toBe(StudioAssetInsertionFailureKinds.invalidByValidation);
      expect(invalid.issues?.some((issue) => issue.code === "slot-cardinality-exceeded")).toBeTrue();
    }
  });

  it("applies schema-driven default config values when inserting assets", () => {
    const registry = createDefaultStudioAssetRegistry();
    const root = Object.freeze({
      nodeId: "root-workflow",
      assetId: "workflow-studio",
      assetVersion: "1.0.0",
    });

    const target = resolveDefaultInsertionTarget({
      registry,
      root,
      parentNodeId: "root-workflow",
    });

    const inserted = insertStudioAssetIntoCompositionTree({
      registry,
      request: {
        root,
        assetId: "ui-primitive:button",
        target: target!,
        config: Object.freeze({ label: "Launch" }),
      },
    });

    expect(inserted.ok).toBeTrue();
    if (inserted.ok) {
      expect(inserted.insertedNode.config).toEqual(Object.freeze({
        label: "Launch",
        helperText: "",
        isVisible: true,
        required: false,
        readOnly: false,
      }));
    }
  });

});
