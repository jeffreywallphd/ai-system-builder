export const DataStudioWorkspaceKinds = Object.freeze({
  schema: "schema",
  pipeline: "pipeline",
} as const);

export type DataStudioWorkspaceKind = typeof DataStudioWorkspaceKinds[keyof typeof DataStudioWorkspaceKinds];

export interface DataStudioWorkspaceDefinition {
  readonly kind: DataStudioWorkspaceKind;
  readonly heading: string;
  readonly summary: string;
  readonly primaryCtaLabel: string;
  readonly emptyStateLabel: string;
}

export const DataStudioWorkspaceDefinitions: Readonly<Record<DataStudioWorkspaceKind, DataStudioWorkspaceDefinition>> = Object.freeze({
  schema: Object.freeze({
    kind: DataStudioWorkspaceKinds.schema,
    heading: "Data structure workspace",
    summary: "Design tables, fields, and relationships in Schema Studio. Keep data movement and transformation flows in Pipeline Studio.",
    primaryCtaLabel: "Create new schema",
    emptyStateLabel: "No schema assets found yet. Create one to define your data structure.",
  }),
  pipeline: Object.freeze({
    kind: DataStudioWorkspaceKinds.pipeline,
    heading: "Data flow workspace",
    summary: "Build ingestion and transformation flows in Pipeline Studio. Link schema assets for structure definitions instead of editing structure here.",
    primaryCtaLabel: "Create new pipeline",
    emptyStateLabel: "No pipeline assets found yet. Create one to define data movement and transformation.",
  }),
});
