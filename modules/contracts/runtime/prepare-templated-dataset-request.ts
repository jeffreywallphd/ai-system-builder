export interface PrepareTemplatedDatasetInputDescriptor {
  artifactId: string;
  localPath: string;
  mediaType: string;
  role?: string;
  name?: string;
}

export interface PrepareTemplatedDatasetRequest {
  sourceInputs: PrepareTemplatedDatasetInputDescriptor[];
  template: string;
  split: {
    trainRatio: number;
    testRatio: number;
    seed?: number;
  };
  outputFormat: "jsonl" | "json" | "csv";
  shuffle?: boolean;
  validationPolicy?: "strict" | "best-effort";
  outputNaming?: {
    baseName?: string;
  };
}
