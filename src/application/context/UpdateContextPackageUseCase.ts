import { ContextPackage, type IContextPackageAuditInfo } from "./models/ContextPackage";
import type { IContextFragment } from "./models/ContextFragment";
import type { IContextPackageReference } from "./models/ContextPackageReference";
import type { IContextPackageRepository } from "../ports/interfaces/IContextPackageRepository";

export interface IUpdateContextPackageRequest {
  readonly contextPackageId: string;
  readonly name: string;
  readonly description?: string;
  readonly version?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly fragments?: ReadonlyArray<IContextFragment>;
  readonly references?: ReadonlyArray<IContextPackageReference>;
  readonly audit?: IContextPackageAuditInfo;
}

export interface IUpdateContextPackageResult {
  readonly contextPackage: ContextPackage;
}

export class UpdateContextPackageUseCase {
  private readonly contextPackageRepository: IContextPackageRepository;
  private readonly now: () => Date;

  constructor(params: {
    contextPackageRepository: IContextPackageRepository;
    now?: () => Date;
  }) {
    this.contextPackageRepository = params.contextPackageRepository;
    this.now = params.now ?? (() => new Date());
  }

  public async execute(
    request: IUpdateContextPackageRequest
  ): Promise<IUpdateContextPackageResult> {
    const contextPackageId = request.contextPackageId.trim();

    if (!contextPackageId) {
      throw new Error("UpdateContextPackageUseCase requires a non-empty contextPackageId.");
    }

    const existingContextPackage = await this.contextPackageRepository.load(contextPackageId);

    if (!existingContextPackage) {
      throw new Error(`Context package '${contextPackageId}' was not found.`);
    }

    const timestamp = this.now();
    const audit = Object.freeze({
      createdAt:
        request.audit?.createdAt ??
        existingContextPackage.audit?.createdAt ??
        timestamp,
      updatedAt: request.audit?.updatedAt ?? timestamp,
    });

    const updatedContextPackage = new ContextPackage({
      id: existingContextPackage.id,
      name: request.name,
      description: request.description,
      version: request.version,
      tags: request.tags,
      fragments: request.fragments,
      references: request.references,
      audit,
    });

    return Object.freeze({
      contextPackage: await this.contextPackageRepository.save(updatedContextPackage),
    });
  }
}
