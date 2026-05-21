export interface SystemFoundationPackCategory {
  readonly categoryId: string;
  readonly displayName: string;
  readonly description: string;
  readonly sortOrder: number;
}

export const SYSTEM_FOUNDATION_PACK_CATEGORIES = [
  {
    categoryId: "ui-structure",
    displayName: "UI Structure",
    description: "Foundational layout and structural building blocks for user-facing screens.",
    sortOrder: 10,
  },
  {
    categoryId: "forms-fields",
    displayName: "Forms and Fields",
    description: "Foundational input and field semantics for collecting user-provided values.",
    sortOrder: 20,
  },
  {
    categoryId: "data-display",
    displayName: "Data Display",
    description: "Foundational presentation semantics for readable data and records.",
    sortOrder: 30,
  },
  {
    categoryId: "state-messages",
    displayName: "State Messages",
    description: "Foundational status, feedback, and empty-state communication patterns.",
    sortOrder: 40,
  },
  {
    categoryId: "page-feature-shells",
    displayName: "Page and Feature Shells",
    description: "Foundational page and feature container semantics for composed product areas.",
    sortOrder: 50,
  },
  {
    categoryId: "workflow-system-shells",
    displayName: "Workflow and System Shells",
    description: "Foundational workflow and system container semantics for larger compositions.",
    sortOrder: 60,
  },
] as const satisfies readonly SystemFoundationPackCategory[];

export const SYSTEM_FOUNDATION_PACK_CATEGORY_IDS =
  SYSTEM_FOUNDATION_PACK_CATEGORIES.map((category) => category.categoryId);

export type SystemFoundationPackCategoryId =
  (typeof SYSTEM_FOUNDATION_PACK_CATEGORY_IDS)[number];
