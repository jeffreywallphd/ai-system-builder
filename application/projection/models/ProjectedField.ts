export type FieldVisibility = "basic" | "advanced" | "hidden";

export interface ProjectedField {
  readonly id: string;
  readonly nodeId: string;
  readonly propertyId: string;
  readonly label: string;
  readonly description?: string;
  readonly type: string;
  readonly required: boolean;
  readonly isEditable: boolean;
  readonly order: number;
  readonly sectionId: string;
  readonly defaultValue?: unknown;
  readonly value?: unknown;
  readonly options?: ReadonlyArray<{ readonly label: string; readonly value: unknown }>;
  readonly visibility: FieldVisibility;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly shouldClampToRange: boolean;
}
