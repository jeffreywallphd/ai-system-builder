import {
  ContextPackage,
  type IContextPackageAuditInfo,
} from "./models/ContextPackage";
import type { IContextFragment } from "./models/ContextFragment";
import type { IContextPackageReference } from "./models/ContextPackageReference";
import type { IContextPackageRepository } from "../ports/interfaces/IContextPackageRepository";

export interface ICreateContextPackageRequest {
  readonly id?: string;
  readonly name: string;
  readonly description?: string;
  readonly version?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly fragments?: ReadonlyArray<IContextFragment>;
  readonly references?: ReadonlyArray<IContextPackageReference>;
  readonly audit?: IContextPackageAuditInfo;
}

export interface ICreateContextPackageResult {
  readonly contextPackage: ContextPackage;
  readonly created: boolean;
}

export class CreateContextPackageUseCase {
  private readonly contextPackageRepository: IContextPackageRepository;
  private readonly createId: () => string;

  constructor(params: {
    contextPackageRepository: IContextPackageRepository;
    createId?: () => string;
  }) {
    this.contextPackageRepository = params.contextPackageRepository;
    this.createId = params.createId ?? defaultIdFactory;
  }

  public async execute(
    request: ICreateContextPackageRequest
  ): Promise<ICreateContextPackageResult> {
    const contextPackage = new ContextPackage({
      id: request.id?.trim() || this.createId(),
      name: request.name,
      description: request.description,
      version: request.version,
      tags: request.tags,
      fragments: request.fragments,
      references: request.references,
      audit: request.audit ?? { createdAt: new Date(), updatedAt: new Date() },
    });

    const created = !(await this.contextPackageRepository.exists(contextPackage.id));
    const savedContextPackage = await this.contextPackageRepository.save(contextPackage);

    return Object.freeze({
      contextPackage: savedContextPackage,
      created,
    });
  }
}

function defaultIdFactory(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `context_pkg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
