import { ContextPackage } from "./models/ContextPackage";
import type { IContextPackageRepository } from "../ports/interfaces/IContextPackageRepository";

export interface ILoadContextPackageRequest {
  readonly contextPackageId: string;
  readonly throwIfNotFound?: boolean;
}

export interface ILoadContextPackageResult {
  readonly contextPackage?: ContextPackage;
}

export class LoadContextPackageUseCase {
  private readonly contextPackageRepository: IContextPackageRepository;

  constructor(contextPackageRepository: IContextPackageRepository) {
    this.contextPackageRepository = contextPackageRepository;
  }

  public async execute(
    request: ILoadContextPackageRequest
  ): Promise<ILoadContextPackageResult> {
    const contextPackageId = request.contextPackageId.trim();

    if (!contextPackageId) {
      throw new Error("LoadContextPackageUseCase requires a non-empty contextPackageId.");
    }

    const contextPackage = await this.contextPackageRepository.load(contextPackageId);

    if (!contextPackage) {
      if (request.throwIfNotFound ?? true) {
        throw new Error(`Context package '${contextPackageId}' was not found.`);
      }

      return Object.freeze({ contextPackage: undefined });
    }

    return Object.freeze({
      contextPackage: ContextPackage.from(contextPackage),
    });
  }
}
