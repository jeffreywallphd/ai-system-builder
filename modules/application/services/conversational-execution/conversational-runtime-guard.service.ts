import type { ConversationalRuntimeGuardPort } from '../../ports/conversational-execution';

export class ConversationalRuntimeGuardService {
  public constructor(private readonly guardPort: ConversationalRuntimeGuardPort) {}
  public async canInvoke(adapterId: string) {
    const status = await this.guardPort.getRuntimeStatus(adapterId);
    return { allowed: status === 'ready', status } as const;
  }
}
