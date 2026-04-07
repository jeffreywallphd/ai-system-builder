import type { INodeDefinition } from "@domain/nodes/interfaces/INodeDefinition";
import type {
  INodeCatalogProvider,
  INodeCatalogSearchCriteria,
} from "../ports/interfaces/INodeCatalogProvider";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeArray(values?: ReadonlyArray<string>): string[] {
  if (!values || values.length === 0) {
    return [];
  }

  return [...new Set(values.map(normalize).filter(Boolean))];
}

function includesAnyNormalized(
  candidates: ReadonlyArray<string> | undefined,
  filters: ReadonlyArray<string> | undefined
): boolean {
  const normalizedFilters = normalizeArray(filters);

  if (normalizedFilters.length === 0) {
    return true;
  }

  const normalizedCandidates = new Set(normalizeArray(candidates));
  return normalizedFilters.some((filter) => normalizedCandidates.has(filter));
}

function definitionMatchesCriteria(
  definition: INodeDefinition,
  criteria?: INodeCatalogSearchCriteria
): boolean {
  if (!criteria) {
    return true;
  }

  if (criteria.query) {
    const query = normalize(criteria.query);
    const haystack = [
      definition.id,
      definition.type,
      definition.title,
      definition.description,
      definition.category,
      definition.executionKind,
      ...definition.capabilities.tasks,
      ...definition.capabilities.runtimes,
    ]
      .filter(Boolean)
      .map((value) => normalize(String(value)));

    const queryMatched = haystack.some((value) => value.includes(query));

    if (!queryMatched) {
      return false;
    }
  }

  if (
    criteria.categories &&
    criteria.categories.length > 0 &&
    !includesAnyNormalized([definition.category], criteria.categories)
  ) {
    return false;
  }

  if (
    criteria.executionKinds &&
    criteria.executionKinds.length > 0 &&
    !criteria.executionKinds.includes(definition.executionKind)
  ) {
    return false;
  }

  if (
    criteria.tasks &&
    criteria.tasks.length > 0 &&
    !includesAnyNormalized(definition.capabilities.tasks, criteria.tasks)
  ) {
    return false;
  }

  if (
    criteria.runtimes &&
    criteria.runtimes.length > 0 &&
    !(
      definition.capabilities.allowsAnyRuntime ||
      includesAnyNormalized(definition.capabilities.runtimes, criteria.runtimes)
    )
  ) {
    return false;
  }

  if (criteria.modalities && criteria.modalities.length > 0) {
    const modalities = new Set<string>();

    for (const property of definition.properties) {
      for (const modality of property.bindingProfile?.modalities ?? []) {
        modalities.add(normalize(modality));
      }
    }

    for (const port of [...definition.inputPorts, ...definition.outputPorts]) {
      for (const modality of port.compatibility.modalities ?? []) {
        modalities.add(normalize(modality));
      }
    }

    const normalizedFilters = normalizeArray(criteria.modalities);
    const matched = normalizedFilters.some((filter) => modalities.has(filter));

    if (!matched) {
      return false;
    }
  }

  if (criteria.basicModeOnly && !definition.isVisibleInBasicMode) {
    return false;
  }

  if (criteria.modelAwareOnly && !definition.isModelAware()) {
    return false;
  }

  return true;
}

function scoreDefinition(
  definition: INodeDefinition,
  criteria?: INodeCatalogSearchCriteria
): number {
  if (!criteria?.query) {
    let score = 0;
    if (definition.isVisibleInBasicMode) score += 5;
    if (definition.isModelAware()) score += 2;
    return score;
  }

  const query = normalize(criteria.query);
  const title = normalize(definition.title);
  const type = normalize(definition.type);
  const category = normalize(definition.category);
  const description = normalize(definition.description ?? "");

  let score = 0;

  if (title === query) score += 250;
  if (type === query) score += 220;
  if (title.startsWith(query)) score += 120;
  if (type.startsWith(query)) score += 110;
  if (title.includes(query)) score += 80;
  if (type.includes(query)) score += 70;
  if (category.includes(query)) score += 30;
  if (description.includes(query)) score += 20;
  if (definition.isVisibleInBasicMode) score += 5;

  return score;
}

function dedupeDefinitions(
  definitions: ReadonlyArray<INodeDefinition>
): ReadonlyArray<INodeDefinition> {
  const deduped = new Map<string, INodeDefinition>();

  for (const definition of definitions) {
    const key = normalize(definition.id || definition.type);
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, definition);
      continue;
    }

    const existingScore =
      (existing.isVisibleInBasicMode ? 1 : 0) +
      (existing.isModelAware() ? 1 : 0);
    const currentScore =
      (definition.isVisibleInBasicMode ? 1 : 0) +
      (definition.isModelAware() ? 1 : 0);

    if (currentScore > existingScore) {
      deduped.set(key, definition);
    }
  }

  return Object.freeze([...deduped.values()]);
}

export class CompositeNodeCatalogProvider implements INodeCatalogProvider {
  private readonly providers: ReadonlyArray<INodeCatalogProvider>;
  private readonly localDefinitions: ReadonlyArray<INodeDefinition>;

  constructor(params: {
    providers?: ReadonlyArray<INodeCatalogProvider>;
    definitions?: ReadonlyArray<INodeDefinition>;
  } = {}) {
    this.providers = Object.freeze([...(params.providers ?? [])]);
    this.localDefinitions = Object.freeze([...(params.definitions ?? [])]);
  }

  public async getAllDefinitions(): Promise<ReadonlyArray<INodeDefinition>> {
    const providerResults = await Promise.all(
      this.providers.map((provider) => provider.getAllDefinitions())
    );

    return Object.freeze(
      [
        ...dedupeDefinitions([...this.localDefinitions, ...providerResults.flat()]),
      ].sort((left, right) =>
        normalize(left.title).localeCompare(normalize(right.title))
      )
    );
  }

  public async searchDefinitions(
    criteria?: INodeCatalogSearchCriteria
  ): Promise<ReadonlyArray<INodeDefinition>> {
    const allDefinitions = await this.getAllDefinitions();

    return Object.freeze(
      allDefinitions
        .filter((definition) => definitionMatchesCriteria(definition, criteria))
        .sort(
          (left, right) =>
            scoreDefinition(right, criteria) - scoreDefinition(left, criteria)
        )
    );
  }

  public async getDefinitionById(
    id: string
  ): Promise<INodeDefinition | undefined> {
    const normalizedId = normalize(id);
    const allDefinitions = await this.getAllDefinitions();

    return allDefinitions.find(
      (definition) =>
        normalize(definition.id) === normalizedId ||
        normalize(definition.type) === normalizedId
    );
  }

  public async getDefinitionByType(
    type: string
  ): Promise<INodeDefinition | undefined> {
    const normalizedType = normalize(type);
    const allDefinitions = await this.getAllDefinitions();

    return allDefinitions.find(
      (definition) => normalize(definition.type) === normalizedType
    );
  }

  public async getCategories(): Promise<ReadonlyArray<string>> {
    const allDefinitions = await this.getAllDefinitions();
    const categories = new Set<string>();

    for (const definition of allDefinitions) {
      categories.add(definition.category);
    }

    return Object.freeze(
      [...categories].sort((left, right) =>
        normalize(left).localeCompare(normalize(right))
      )
    );
  }

  public withDefinition(
    definition: INodeDefinition
  ): CompositeNodeCatalogProvider {
    return new CompositeNodeCatalogProvider({
      providers: this.providers,
      definitions: [...this.localDefinitions, definition],
    });
  }

  public withProvider(
    provider: INodeCatalogProvider
  ): CompositeNodeCatalogProvider {
    return new CompositeNodeCatalogProvider({
      providers: [...this.providers, provider],
      definitions: this.localDefinitions,
    });
  }
}

