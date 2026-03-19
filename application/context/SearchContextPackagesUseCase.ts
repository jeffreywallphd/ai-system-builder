import type {
  IContextPackageListCriteria,
  IContextPackageRepository,
  IContextPackageSummary,
} from "../ports/interfaces/IContextPackageRepository";

const defaultSearchLimit = 25;
const maxSearchLimit = 50;

export interface ISearchContextPackagesRequest {
  readonly query?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly limit?: number;
}

export interface ISearchContextPackagesResult {
  readonly criteria: IContextPackageListCriteria;
  readonly contextPackages: ReadonlyArray<IContextPackageSummary>;
}

function normalizeTags(tags?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  if (!tags) {
    return undefined;
  }

  const normalized = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

function normalizeLimit(limit?: number): number {
  if (!Number.isFinite(limit) || !limit || limit <= 0) {
    return defaultSearchLimit;
  }

  return Math.min(Math.floor(limit), maxSearchLimit);
}

export class SearchContextPackagesUseCase {
  private readonly contextPackageRepository: IContextPackageRepository;

  constructor(contextPackageRepository: IContextPackageRepository) {
    this.contextPackageRepository = contextPackageRepository;
  }

  public async execute(
    request: ISearchContextPackagesRequest = {}
  ): Promise<ISearchContextPackagesResult> {
    const criteria = Object.freeze({
      query: request.query?.trim() || undefined,
      tags: normalizeTags(request.tags),
      limit: normalizeLimit(request.limit),
    });

    const contextPackages = await this.contextPackageRepository.list(criteria);

    return Object.freeze({
      criteria,
      contextPackages: Object.freeze([...contextPackages]),
    });
  }
}
