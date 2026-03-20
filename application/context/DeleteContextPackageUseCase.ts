import type { IContextPackageRepository } from "../ports/interfaces/IContextPackageRepository";

export interface IDeleteContextPackageRequest {
  readonly contextPackageId: string;
  readonly throwIfNotFound?: boolean;
}

export interface IDeleteContextPackageResult {
  readonly deleted: boolean;
}

export class DeleteContextPackageUseCase {
  private readonly contextPackageRepository: IContextPackageRepository;

  constructor(contextPackageRepository: IContextPackageRepository) {
    this.contextPackageRepository = contextPackageRepository;
  }

  public async execute(
    request: IDeleteContextPackageRequest
  ): Promise<IDeleteContextPackageResult> {
    const contextPackageId = request.contextPackageId.trim();

    if (!contextPackageId) {
      throw new Error("DeleteContextPackageUseCase requires a non-empty contextPackageId.");
    }

    const exists = await this.contextPackageRepository.exists(contextPackageId);

    if (!exists) {
      if (request.throwIfNotFound ?? true) {
        throw new Error(`Context package '${contextPackageId}' was not found.`);
      }

      return Object.freeze({ deleted: false });
    }

    await this.contextPackageRepository.delete(contextPackageId);

    return Object.freeze({ deleted: true });
  }
}
