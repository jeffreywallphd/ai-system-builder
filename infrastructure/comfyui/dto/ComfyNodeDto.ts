export interface ComfyNodeDto {
  readonly class_type: string;
  readonly inputs: Readonly<Record<string, unknown>>;
}
