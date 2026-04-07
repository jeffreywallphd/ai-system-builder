import type { CompositionTaxonomyDescriptor, TaxonomySemanticRole } from "../../src/domain/taxonomy/CompositionTaxonomy";

export const UxTaxonomyPresentationModes = Object.freeze({
  intentPrimary: "intent-primary",
  metadataOnly: "metadata-only",
  taxonomyPrimary: "taxonomy-primary",
});

export type UxTaxonomyPresentationMode = typeof UxTaxonomyPresentationModes[keyof typeof UxTaxonomyPresentationModes];

export const UxTaxonomyVisibilityRules = Object.freeze({
  primaryNavigation: "primary-navigation",
  studioEntryAction: "studio-entry-action",
  inlineCreationAction: "inline-creation-action",
  registryPrimary: "registry-primary",
  taxonomyFilters: "taxonomy-filters",
  taxonomyMetadata: "taxonomy-metadata",
});

export type UxTaxonomyVisibilityRule = typeof UxTaxonomyVisibilityRules[keyof typeof UxTaxonomyVisibilityRules];

const taxonomySuppressionPolicy: Readonly<Record<UxTaxonomyVisibilityRule, UxTaxonomyPresentationMode>> = Object.freeze({
  [UxTaxonomyVisibilityRules.primaryNavigation]: UxTaxonomyPresentationModes.intentPrimary,
  [UxTaxonomyVisibilityRules.studioEntryAction]: UxTaxonomyPresentationModes.intentPrimary,
  [UxTaxonomyVisibilityRules.inlineCreationAction]: UxTaxonomyPresentationModes.intentPrimary,
  [UxTaxonomyVisibilityRules.registryPrimary]: UxTaxonomyPresentationModes.intentPrimary,
  [UxTaxonomyVisibilityRules.taxonomyFilters]: UxTaxonomyPresentationModes.taxonomyPrimary,
  [UxTaxonomyVisibilityRules.taxonomyMetadata]: UxTaxonomyPresentationModes.metadataOnly,
});

export class UxTaxonomySuppressionPolicy {
  public resolvePresentationMode(rule: UxTaxonomyVisibilityRule): UxTaxonomyPresentationMode {
    return taxonomySuppressionPolicy[rule] ?? UxTaxonomyPresentationModes.intentPrimary;
  }

  public shouldShowTaxonomyAsPrimary(rule: UxTaxonomyVisibilityRule): boolean {
    return this.resolvePresentationMode(rule) === UxTaxonomyPresentationModes.taxonomyPrimary;
  }
}

const intentRoleLabelMap: Readonly<Record<TaxonomySemanticRole, string>> = Object.freeze({
  model: "AI capability",
  dataset: "Data asset",
  schema: "Data blueprint",
  tool: "Task capability",
  "prompt-template": "Prompt asset",
  "embedding-index": "Knowledge index",
  "config-profile": "Configuration",
  workflow: "Automation flow",
  agent: "Assistant plan",
  "context-bundle": "Context package",
  "dataset-pipeline": "Data preparation flow",
  "training-recipe": "Training plan",
  "tool-chain": "Capability sequence",
  "app-template": "Solution template",
  system: "Solution system",
});

function resolveRole(taxonomy?: CompositionTaxonomyDescriptor): TaxonomySemanticRole | undefined {
  return taxonomy?.semanticRole;
}

export class UxAssetPresentationLabelResolver {
  public resolveAssetLabel(taxonomy: CompositionTaxonomyDescriptor | undefined, rule: UxTaxonomyVisibilityRule): string {
    const role = resolveRole(taxonomy);
    if (!role) {
      return "Asset";
    }

    const policy = new UxTaxonomySuppressionPolicy();
    if (policy.shouldShowTaxonomyAsPrimary(rule)) {
      return role;
    }

    return intentRoleLabelMap[role] ?? "Asset";
  }
}

export class UxStudioEntryLabelResolver {
  public resolveOpenLabel(taxonomy: CompositionTaxonomyDescriptor | undefined): string {
    const label = new UxAssetPresentationLabelResolver().resolveAssetLabel(taxonomy, UxTaxonomyVisibilityRules.studioEntryAction);
    return `Open ${label} workspace`;
  }

  public resolveCreateInlineLabel(taxonomy: CompositionTaxonomyDescriptor | undefined): string {
    const label = new UxAssetPresentationLabelResolver().resolveAssetLabel(taxonomy, UxTaxonomyVisibilityRules.inlineCreationAction);
    return `Create ${label}`;
  }

  public resolveNavigationTitle(routeKey: string, fallback: string): string {
    const navigationLabels: Readonly<Record<string, string>> = Object.freeze({
      home: "Home",
      build: "Build",
      workflows: "Build",
      tools: "Capabilities",
      models: "AI Library",
      context: "Context",
      mcp: "Integrations",
      services: "Operations",
      assets: "Asset Center",
      "agent-studio": "Assistants",
      "studio-shell": "Studios",
      registry: "Explore",
      settings: "Settings",
    });
    return navigationLabels[routeKey] ?? fallback;
  }
}
