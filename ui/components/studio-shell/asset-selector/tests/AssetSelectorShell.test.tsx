import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AssetSelectorSelectionModes,
  AssetSelectorSelectionTypes,
  createAssetSelectorRequest,
} from "../../../../../src/domain/studio-shell/AssetSelectorContract";
import {
  AssetSelectorSessionLifecycleStates,
  type AssetSelectorSessionState,
} from "../../../../../application/studio-entry/AssetSelectorSessionStore";
import AssetSelectorShell from "../AssetSelectorShell";

function createState(input?: {
  readonly mode?: "single-select" | "multi-select";
  readonly selectedAssetIds?: ReadonlyArray<string>;
  readonly required?: boolean;
}): AssetSelectorSessionState {
  const request = createAssetSelectorRequest({
    requestId: "selector:test",
    assetType: "dataset",
    selectionMode: input?.mode ?? AssetSelectorSelectionModes.multiSelect,
    allowedSelectionTypes: [AssetSelectorSelectionTypes.existingAsset, AssetSelectorSelectionTypes.createNewAsset],
    constraints: {
      required: input?.required ?? false,
      minSelections: input?.required ? 1 : 0,
    },
    context: {
      originatingStudio: "workflow-studio",
      originatingField: "inputs",
      usageContext: "workflow-input",
    },
  });
  const selected = (input?.selectedAssetIds ?? []).map((assetId) => Object.freeze({
    assetId,
    assetType: "dataset" as const,
  }));
  return Object.freeze({
    sessionKey: "selector:test",
    request,
    lifecycleState: AssetSelectorSessionLifecycleStates.active,
    selectedAssets: Object.freeze(selected),
    pendingSelections: Object.freeze(selected),
    validationErrors: Object.freeze([]),
    lifecycleHistory: Object.freeze([
      AssetSelectorSessionLifecycleStates.idle,
      AssetSelectorSessionLifecycleStates.active,
    ]),
  });
}

describe("AssetSelectorShell", () => {
  it("renders loading, empty, and error states", () => {
    const baseProps = {
      title: "Datasets",
      state: createState(),
      searchTerm: "",
      items: [],
      onSearchTermChange: () => undefined,
      onToggleSelection: () => undefined,
      onConfirm: () => undefined,
      onCancel: () => undefined,
      onCreateNew: () => undefined,
    };
    const loading = renderToStaticMarkup(
      <AssetSelectorShell {...baseProps} loading error={undefined} />,
    );
    const empty = renderToStaticMarkup(
      <AssetSelectorShell {...baseProps} loading={false} error={undefined} />,
    );
    const error = renderToStaticMarkup(
      <AssetSelectorShell {...baseProps} loading={false} error="failed to load" />,
    );

    expect(loading).toContain('data-testid="asset-selector-loading"');
    expect(empty).toContain('data-testid="asset-selector-empty"');
    expect(error).toContain('data-testid="asset-selector-error"');
  });

  it("renders populated state with selection summary for multi-select", () => {
    const html = renderToStaticMarkup(
      <AssetSelectorShell
        title="Datasets"
        state={createState({
          mode: "multi-select",
          selectedAssetIds: ["asset:dataset:customers", "asset:dataset:orders"],
        })}
        searchTerm=""
        items={[{
          id: "dataset:customers",
          title: "Customers",
          subtitle: "v1",
          badges: ["dataset"],
          asset: {
            assetId: "asset:dataset:customers",
            assetType: "dataset",
          },
        }]}
        loading={false}
        onSearchTermChange={() => undefined}
        onToggleSelection={() => undefined}
        onConfirm={() => undefined}
        onCancel={() => undefined}
        onCreateNew={() => undefined}
      />,
    );

    expect(html).toContain("2 selected");
    expect(html).toContain("Multi-select");
    expect(html).toContain('data-testid="asset-selector-results"');
  });

  it("shows single-select mode and disables confirm when required and no selection", () => {
    const html = renderToStaticMarkup(
      <AssetSelectorShell
        title="Datasets"
        state={createState({
          mode: "single-select",
          selectedAssetIds: [],
          required: true,
        })}
        searchTerm=""
        items={[{
          id: "dataset:customers",
          title: "Customers",
          asset: {
            assetId: "asset:dataset:customers",
            assetType: "dataset",
          },
        }]}
        loading={false}
        onSearchTermChange={() => undefined}
        onToggleSelection={() => undefined}
        onConfirm={() => undefined}
        onCancel={() => undefined}
        onCreateNew={() => undefined}
      />,
    );

    expect(html).toContain("Single-select");
    expect(html).toContain('data-testid="asset-selector-cancel"');
    expect(html).toContain('data-testid="asset-selector-confirm"');
    expect(html).toContain("disabled");
  });
});
