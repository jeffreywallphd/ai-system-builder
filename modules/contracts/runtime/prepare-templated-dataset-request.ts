export interface PrepareTemplatedDatasetRequest {
  sourceArtifactIds: string[];
  template: string;
  split: {
    trainRatio: number;
    testRatio: number;
    seed?: number;
  };
  outputFormat: "jsonl" | "json" | "csv";
}
