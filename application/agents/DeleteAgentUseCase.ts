import type { IAgentRepository } from "../ports/interfaces/IAgentRepository";

export class DeleteAgentUseCase {
  constructor(private readonly repository: IAgentRepository) {}

  public async execute(id: string): Promise<boolean> {
    const normalized = id.trim();
    if (!normalized) {
      return false;
    }
    return this.repository.delete(normalized);
  }
}
