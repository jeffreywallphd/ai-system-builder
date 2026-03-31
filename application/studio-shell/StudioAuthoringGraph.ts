export interface StudioAuthoringGraphNode {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly groupId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface StudioAuthoringGraphEdge {
  readonly id: string;
  readonly kind: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly label?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface StudioAuthoringGraphGroup {
  readonly id: string;
  readonly title: string;
  readonly order: number;
  readonly nodeIds: ReadonlyArray<string>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface StudioAuthoringGraphProjection {
  readonly source: "wizard" | "canvas" | "pipeline";
  readonly nodes: ReadonlyArray<StudioAuthoringGraphNode>;
  readonly edges: ReadonlyArray<StudioAuthoringGraphEdge>;
  readonly groups: ReadonlyArray<StudioAuthoringGraphGroup>;
}

