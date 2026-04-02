export const ExperienceAssetModeIds = Object.freeze({
  wizard: "wizard",
  canvas: "canvas",
});

export type ExperienceAssetModeId = typeof ExperienceAssetModeIds[keyof typeof ExperienceAssetModeIds];

export interface ExperienceAssetModeDefinition {
  readonly id: ExperienceAssetModeId;
  readonly title: string;
  readonly summary: string;
  readonly intent?: "guided-authoring" | "graph-authoring";
}

export interface WizardExperienceDefinition extends ExperienceAssetModeDefinition {
  readonly id: "wizard";
  readonly pageOrder?: ReadonlyArray<string>;
}

export interface CanvasExperienceDefinition extends ExperienceAssetModeDefinition {
  readonly id: "canvas";
  readonly supportsNodePalette?: boolean;
}

export interface ExperienceAssetDocumentParseResult<TDocument> {
  readonly document?: TDocument;
  readonly parseError?: string;
}

export interface ExperienceAssetDocumentAdapter<TDocument> {
  parse(content: string): ExperienceAssetDocumentParseResult<TDocument>;
  serialize(document: TDocument): string;
}

export interface ExperienceAssetValidationAdapter<TDocument, TIssue> {
  validate(document: TDocument): ReadonlyArray<TIssue>;
}

export interface ExperienceAssetActionContext<TDocument, TIssue> {
  readonly document: TDocument;
  readonly issues: ReadonlyArray<TIssue>;
}

export interface ExperienceAssetActionDefinition<TDocument, TIssue> {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly tone?: "default" | "primary" | "ghost";
  readonly disabled?: boolean;
  readonly run?: (context: ExperienceAssetActionContext<TDocument, TIssue>) => void | Promise<void>;
}

export interface ExperienceAssetDefinition<TDocument, TIssue> {
  readonly id: string;
  readonly title: string;
  readonly defaultModeId: ExperienceAssetModeId;
  readonly modes: ReadonlyArray<ExperienceAssetModeDefinition>;
  readonly wizard?: WizardExperienceDefinition;
  readonly canvas?: CanvasExperienceDefinition;
  readonly documentAdapter?: ExperienceAssetDocumentAdapter<TDocument>;
  readonly validationAdapter?: ExperienceAssetValidationAdapter<TDocument, TIssue>;
}

export function isExperienceAssetModeId(value: string): value is ExperienceAssetModeId {
  return value === ExperienceAssetModeIds.wizard || value === ExperienceAssetModeIds.canvas;
}
