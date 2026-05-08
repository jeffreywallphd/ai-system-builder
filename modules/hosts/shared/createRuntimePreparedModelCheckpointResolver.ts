import type {
  ModelCheckpointResolverPort,
  ResolveModelCheckpointRequest,
  ResolveModelCheckpointResult,
} from "../../application/ports/model";

export interface RuntimePreparationPort {
  start(): Promise<void>;
}

export function createRuntimePreparedModelCheckpointResolver(input: {
  runtime: RuntimePreparationPort;
  modelCheckpointResolver: ModelCheckpointResolverPort;
}): ModelCheckpointResolverPort {
  return {
    async resolveCheckpoint(request: ResolveModelCheckpointRequest): Promise<ResolveModelCheckpointResult> {
      await input.runtime.start();
      return input.modelCheckpointResolver.resolveCheckpoint(request);
    },
  };
}
