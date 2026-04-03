import type {
  StudioAssetCompositionNode,
  StudioAssetCompositionValidationIssue,
  StudioAssetCompositionValidationIssueCode,
} from "../studio-assets/StudioAssetComposition";
import { StudioAssetCompositionValidationIssueCodes } from "../studio-assets/StudioAssetComposition";
import type { StudioAssetRegistry } from "../studio-assets/StudioAssetRegistry";
import {
  createDefaultPanelCompositionRoot,
  resolvePanelContainerConfig,
  type PanelAssetContract,
  type PanelContainerConfig,
} from "./PanelAssetContracts";

export const PanelCompositionStatusKinds = Object.freeze({
  ready: "ready",
  empty: "empty",
  invalidConfiguration: "invalid-configuration",
  unresolvedChild: "unresolved-child",
});

export type PanelCompositionStatusKind =
  typeof PanelCompositionStatusKinds[keyof typeof PanelCompositionStatusKinds];

export interface PanelCompositionStatusNotice {
  readonly kind: PanelCompositionStatusKind;
  readonly title: string;
  readonly description: string;
}

export interface ResolvedPanelCompositionState {
  readonly root: StudioAssetCompositionNode;
  readonly panelContainerConfig: PanelContainerConfig;
  readonly notice?: PanelCompositionStatusNotice;
  readonly childCount: number;
  readonly validationIssues: ReadonlyArray<StudioAssetCompositionValidationIssue>;
}

const invalidIssueCodes = new Set<StudioAssetCompositionValidationIssueCode>([
  StudioAssetCompositionValidationIssueCodes.unsupportedContainer,
  StudioAssetCompositionValidationIssueCodes.slotNotSupported,
  StudioAssetCompositionValidationIssueCodes.slotRequired,
  StudioAssetCompositionValidationIssueCodes.regionRequired,
  StudioAssetCompositionValidationIssueCodes.childKindNotAllowed,
  StudioAssetCompositionValidationIssueCodes.childTypeNotAllowed,
  StudioAssetCompositionValidationIssueCodes.childCategoryNotAllowed,
  StudioAssetCompositionValidationIssueCodes.slotCardinalityExceeded,
  StudioAssetCompositionValidationIssueCodes.regionCardinalityExceeded,
  StudioAssetCompositionValidationIssueCodes.atomicCannotContainChildren,
  StudioAssetCompositionValidationIssueCodes.invalidNesting,
]);

const unresolvedIssueCodes = new Set<StudioAssetCompositionValidationIssueCode>([
  StudioAssetCompositionValidationIssueCodes.unknownAsset,
  StudioAssetCompositionValidationIssueCodes.assetVersionMismatch,
]);

function collectChildCount(root: StudioAssetCompositionNode): number {
  const countChildren = (node: StudioAssetCompositionNode): number => {
    let count = 0;
    for (const slot of node.slots ?? []) {
      count += slot.children.length;
      for (const child of slot.children) {
        count += countChildren(child);
      }
    }
    for (const region of node.regions ?? []) {
      count += region.children.length;
      for (const child of region.children) {
        count += countChildren(child);
      }
    }
    return count;
  };
  return countChildren(root);
}

function hasConfiguredPresentation(config: PanelContainerConfig, panel: PanelAssetContract): boolean {
  const hasCustomLayout = config.layout.mode !== "vertical-stack"
    || config.layout.gap !== 12
    || config.layout.columns !== undefined;
  const hasCustomHeader = config.header.visible === false
    || config.header.actions.length > 0
    || (config.header.title.trim().length > 0 && config.header.title.trim() !== panel.title.trim())
    || ((config.header.subtitle ?? "").trim().length > 0 && (config.header.subtitle ?? "").trim() !== (panel.description ?? "").trim());
  return hasCustomLayout || hasCustomHeader;
}

function normalizeRootConfig(input: {
  readonly panel: PanelAssetContract;
  readonly root: StudioAssetCompositionNode;
  readonly panelContainerConfig: PanelContainerConfig;
}): StudioAssetCompositionNode {
  return Object.freeze({
    ...input.root,
    config: Object.freeze({
      ...(input.root.config ?? {}),
      layout: input.panelContainerConfig.layout,
      header: input.panelContainerConfig.header,
    }),
  });
}

export function resolvePanelCompositionState(input: {
  readonly panel: PanelAssetContract;
  readonly registry: StudioAssetRegistry;
}): ResolvedPanelCompositionState {
  const fallbackRoot = createDefaultPanelCompositionRoot(input.panel);
  const fallbackConfig = resolvePanelContainerConfig({
    panel: input.panel,
    config: fallbackRoot.config,
  });

  if (input.panel.content?.kind !== "asset-composition") {
    return Object.freeze({
      root: normalizeRootConfig({ panel: input.panel, root: fallbackRoot, panelContainerConfig: fallbackConfig }),
      panelContainerConfig: fallbackConfig,
      childCount: 0,
      validationIssues: Object.freeze([]),
      notice: Object.freeze({
        kind: PanelCompositionStatusKinds.empty,
        title: "This section is ready for content",
        description: "Add content items from the library to begin designing this section.",
      }),
    });
  }

  try {
    const parsed = input.registry.deserializeCompositionTree({
      serialized: input.panel.content.serializedDocument,
      validate: true,
    });
    const panelContainerConfig = resolvePanelContainerConfig({
      panel: input.panel,
      config: parsed.root.config,
    });
    const root = normalizeRootConfig({
      panel: input.panel,
      root: parsed.root,
      panelContainerConfig,
    });

    const childCount = collectChildCount(root);
    const hasInvalid = parsed.validation.issues.some((issue) => invalidIssueCodes.has(issue.code));
    const hasUnresolved = parsed.validation.issues.some((issue) => unresolvedIssueCodes.has(issue.code));

    let notice: PanelCompositionStatusNotice | undefined;
    if (hasInvalid) {
      notice = Object.freeze({
        kind: PanelCompositionStatusKinds.invalidConfiguration,
        title: "This section needs a quick fix",
        description: "Some content settings are incomplete. Review the notes below and adjust the section structure.",
      });
    } else if (hasUnresolved) {
      notice = Object.freeze({
        kind: PanelCompositionStatusKinds.unresolvedChild,
        title: "Some content can’t be shown yet",
        description: "One or more items could not be resolved. Replace or remove the missing items to continue.",
      });
    } else if (childCount === 0) {
      notice = Object.freeze({
        kind: PanelCompositionStatusKinds.empty,
        title: "This section is ready for content",
        description: hasConfiguredPresentation(panelContainerConfig, input.panel)
          ? "Layout and header settings are saved. Add content items when you are ready."
          : "Add content items from the library to begin designing this section.",
      });
    }

    return Object.freeze({
      root,
      panelContainerConfig,
      childCount,
      validationIssues: parsed.validation.issues,
      notice,
    });
  } catch {
    return Object.freeze({
      root: normalizeRootConfig({ panel: input.panel, root: fallbackRoot, panelContainerConfig: fallbackConfig }),
      panelContainerConfig: fallbackConfig,
      childCount: 0,
      validationIssues: Object.freeze([
        Object.freeze({
          code: StudioAssetCompositionValidationIssueCodes.unsupportedContainer,
          path: "root",
          message: "Saved section content could not be read.",
        }),
      ]),
      notice: Object.freeze({
        kind: PanelCompositionStatusKinds.invalidConfiguration,
        title: "This section needs a quick fix",
        description: "Saved content could not be loaded. Rebuild this section by adding content items again.",
      }),
    });
  }
}
