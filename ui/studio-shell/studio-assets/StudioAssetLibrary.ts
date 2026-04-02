import { StudioAssetRegistrationCategories, type StudioAssetRegistration, type StudioAssetRegistrationCategory, type StudioAssetRegistry } from "./StudioAssetRegistry";

export const StudioAssetLibraryGroupKinds = Object.freeze({
  atomicUi: "atomic-ui-assets",
  composedUi: "composed-ui-assets",
  systemPage: "system-page-assets",
});

export type StudioAssetLibraryGroupKind =
  typeof StudioAssetLibraryGroupKinds[keyof typeof StudioAssetLibraryGroupKinds];

export interface StudioAssetLibraryEntry {
  readonly id: string;
  readonly assetType: string;
  readonly title: string;
  readonly description?: string;
  readonly group: string;
  readonly iconToken?: string;
  readonly category: StudioAssetRegistrationCategory;
  readonly contractCategory: string;
  readonly tags: ReadonlyArray<string>;
  readonly keywords: ReadonlyArray<string>;
  readonly registration: StudioAssetRegistration;
}

export interface StudioAssetLibrarySection {
  readonly id: StudioAssetLibraryGroupKind;
  readonly title: string;
  readonly category: StudioAssetRegistrationCategory;
  readonly entries: ReadonlyArray<StudioAssetLibraryEntry>;
}

export interface StudioAssetLibraryQuery {
  readonly searchText?: string;
  readonly categories?: ReadonlyArray<StudioAssetRegistrationCategory>;
}

function mapGroupKind(category: StudioAssetRegistrationCategory): StudioAssetLibraryGroupKind {
  if (category === StudioAssetRegistrationCategories.atomicUi) {
    return StudioAssetLibraryGroupKinds.atomicUi;
  }
  if (category === StudioAssetRegistrationCategories.composedUi) {
    return StudioAssetLibraryGroupKinds.composedUi;
  }
  return StudioAssetLibraryGroupKinds.systemPage;
}

function mapSectionTitle(category: StudioAssetRegistrationCategory): string {
  if (category === StudioAssetRegistrationCategories.atomicUi) {
    return "Atomic UI assets";
  }
  if (category === StudioAssetRegistrationCategories.composedUi) {
    return "Composed UI assets";
  }
  return "System & page assets";
}

function normalizeSearchTerms(value: string | undefined): ReadonlyArray<string> {
  if (!value) {
    return Object.freeze([]);
  }

  const terms = value
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter((entry) => entry.length > 0);

  return Object.freeze(terms);
}

function matchesSearch(entry: StudioAssetLibraryEntry, searchTerms: ReadonlyArray<string>): boolean {
  if (searchTerms.length === 0) {
    return true;
  }

  const corpus = [
    entry.id,
    entry.assetType,
    entry.title,
    entry.description,
    entry.group,
    entry.iconToken,
    entry.contractCategory,
    ...entry.tags,
    ...entry.keywords,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLocaleLowerCase();

  return searchTerms.every((term) => corpus.includes(term));
}

export function createStudioAssetLibraryEntry(registration: StudioAssetRegistration): StudioAssetLibraryEntry {
  return Object.freeze({
    id: registration.id,
    assetType: registration.metadata.assetType,
    title: registration.metadata.title,
    description: registration.metadata.summary,
    group: registration.metadata.group,
    iconToken: registration.metadata.iconToken,
    category: registration.category,
    contractCategory: registration.metadata.contractCategory,
    tags: registration.metadata.tags,
    keywords: registration.metadata.keywords,
    registration,
  });
}

export function listStudioAssetLibrarySections(input: {
  readonly registry: StudioAssetRegistry;
  readonly query?: StudioAssetLibraryQuery;
}): ReadonlyArray<StudioAssetLibrarySection> {
  const searchTerms = normalizeSearchTerms(input.query?.searchText);
  const categoryFilter = input.query?.categories;

  const categories: ReadonlyArray<StudioAssetRegistrationCategory> = categoryFilter && categoryFilter.length > 0
    ? Object.freeze([...categoryFilter])
    : Object.freeze([
      StudioAssetRegistrationCategories.atomicUi,
      StudioAssetRegistrationCategories.composedUi,
      StudioAssetRegistrationCategories.systemPage,
    ]);

  const sections = categories.map((category) => {
    const entries = input.registry
      .listByCategory(category)
      .map((entry) => createStudioAssetLibraryEntry(entry))
      .filter((entry) => matchesSearch(entry, searchTerms));

    return Object.freeze({
      id: mapGroupKind(category),
      title: mapSectionTitle(category),
      category,
      entries: Object.freeze(entries),
    });
  });

  return Object.freeze(sections.filter((section) => section.entries.length > 0));
}
