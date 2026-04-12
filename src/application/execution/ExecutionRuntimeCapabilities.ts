export interface IExecutionRuntimeCapabilities {
  readonly supportsProgressEvents: boolean;
  readonly supportsPollingProgress: boolean;
  readonly supportsCancellation: boolean;
  readonly supportsIntermediateArtifacts: boolean;
  readonly supportsPartialResults: boolean;
  readonly supportsReconnectOrResume: boolean;
  readonly supportsMultiUnitComposition: boolean;
}

export function toExecutionRuntimeCapabilityMetadata(
  capabilities: IExecutionRuntimeCapabilities,
): Readonly<Record<string, boolean>> {
  return Object.freeze({
    supportsProgressEvents: capabilities.supportsProgressEvents,
    supportsPollingProgress: capabilities.supportsPollingProgress,
    supportsCancellation: capabilities.supportsCancellation,
    supportsIntermediateArtifacts: capabilities.supportsIntermediateArtifacts,
    supportsPartialResults: capabilities.supportsPartialResults,
    supportsReconnectOrResume: capabilities.supportsReconnectOrResume,
    supportsMultiUnitComposition: capabilities.supportsMultiUnitComposition,
  });
}

export const ExecutionRuntimeCapabilityProfiles = Object.freeze({
  workflow: Object.freeze<IExecutionRuntimeCapabilities>({
    supportsProgressEvents: true,
    supportsPollingProgress: false,
    supportsCancellation: true,
    supportsIntermediateArtifacts: true,
    supportsPartialResults: false,
    supportsReconnectOrResume: false,
    supportsMultiUnitComposition: false,
  }),
  datasetGeneration: Object.freeze<IExecutionRuntimeCapabilities>({
    supportsProgressEvents: false,
    supportsPollingProgress: false,
    supportsCancellation: false,
    supportsIntermediateArtifacts: false,
    supportsPartialResults: true,
    supportsReconnectOrResume: false,
    supportsMultiUnitComposition: false,
  }),
  modelPreparation: Object.freeze<IExecutionRuntimeCapabilities>({
    supportsProgressEvents: false,
    supportsPollingProgress: false,
    supportsCancellation: false,
    supportsIntermediateArtifacts: true,
    supportsPartialResults: false,
    supportsReconnectOrResume: false,
    supportsMultiUnitComposition: false,
  }),
  modelTraining: Object.freeze<IExecutionRuntimeCapabilities>({
    supportsProgressEvents: true,
    supportsPollingProgress: true,
    supportsCancellation: true,
    supportsIntermediateArtifacts: true,
    supportsPartialResults: true,
    supportsReconnectOrResume: true,
    supportsMultiUnitComposition: false,
  }),
  mcpServerOperation: Object.freeze<IExecutionRuntimeCapabilities>({
    supportsProgressEvents: false,
    supportsPollingProgress: false,
    supportsCancellation: false,
    supportsIntermediateArtifacts: false,
    supportsPartialResults: false,
    supportsReconnectOrResume: false,
    supportsMultiUnitComposition: false,
  }),
  mcpProvisionAndConnect: Object.freeze<IExecutionRuntimeCapabilities>({
    supportsProgressEvents: false,
    supportsPollingProgress: false,
    supportsCancellation: false,
    supportsIntermediateArtifacts: false,
    supportsPartialResults: false,
    supportsReconnectOrResume: true,
    supportsMultiUnitComposition: true,
  }),
});
