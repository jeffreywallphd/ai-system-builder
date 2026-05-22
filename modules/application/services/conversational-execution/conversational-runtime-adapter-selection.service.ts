import type { ConversationalInvocationRuntimeReference, ConversationalRuntimeAdapterCatalogPort } from '../../ports/conversational-execution';

export class ConversationalRuntimeAdapterSelectionService {
  public constructor(private readonly catalog: ConversationalRuntimeAdapterCatalogPort) {}
  public async select(runtime: ConversationalInvocationRuntimeReference) {
    return this.catalog.resolveForRuntime(runtime);
  }
}
