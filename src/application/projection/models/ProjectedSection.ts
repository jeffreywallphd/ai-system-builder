import type { ProjectedField } from "./ProjectedField";

export interface ProjectedSection<TField extends ProjectedField = ProjectedField> {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly order: number;
  readonly fields: ReadonlyArray<TField>;
}
