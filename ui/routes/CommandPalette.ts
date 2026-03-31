import { ROUTE_PATHS } from "./RouteConfig";

export const CommandPaletteActionKinds = Object.freeze({
  navigate: "navigate",
});

export type CommandPaletteActionKind = typeof CommandPaletteActionKinds[keyof typeof CommandPaletteActionKinds];

export interface CommandPaletteAction {
  readonly kind: CommandPaletteActionKind;
  readonly launchPath: string;
}

export interface CommandPaletteEntry {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly keywords: ReadonlyArray<string>;
  readonly category: "navigation";
  readonly action: CommandPaletteAction;
}

export interface CommandPaletteQuery {
  readonly searchText: string;
}

export interface CommandPaletteContext {
  readonly pathname: string;
  readonly search: string;
}

export interface CommandPaletteModel {
  readonly placeholder: string;
  readonly entries: ReadonlyArray<CommandPaletteEntry>;
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

function toScoredEntries(entries: ReadonlyArray<CommandPaletteEntry>, searchText: string): ReadonlyArray<CommandPaletteEntry> {
  const normalized = normalizeSearchText(searchText);
  if (!normalized) {
    return entries;
  }

  const scored = entries
    .map((entry) => {
      const haystack = `${entry.label} ${entry.description} ${entry.keywords.join(" ")}`.toLowerCase();
      const labelScore = entry.label.toLowerCase().startsWith(normalized) ? 4 : entry.label.toLowerCase().includes(normalized) ? 3 : 0;
      const keywordScore = entry.keywords.some((keyword) => keyword.toLowerCase().includes(normalized)) ? 2 : 0;
      const descriptionScore = entry.description.toLowerCase().includes(normalized) ? 1 : 0;
      const score = haystack.includes(normalized) ? labelScore + keywordScore + descriptionScore : 0;
      return { entry, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.entry.label.localeCompare(right.entry.label));

  return Object.freeze(scored.map((entry) => entry.entry));
}

export class CommandPaletteEntryResolver {
  public resolveEntries(): ReadonlyArray<CommandPaletteEntry> {
    return Object.freeze([
      Object.freeze({
        id: "nav:build",
        label: "Build",
        description: "Open Build.",
        keywords: Object.freeze(["go", "open", "build"]),
        category: "navigation",
        action: Object.freeze({ kind: CommandPaletteActionKinds.navigate, launchPath: ROUTE_PATHS.build }),
      }),
      Object.freeze({
        id: "nav:run",
        label: "Run",
        description: "Open Run.",
        keywords: Object.freeze(["go", "open", "run", "test"]),
        category: "navigation",
        action: Object.freeze({ kind: CommandPaletteActionKinds.navigate, launchPath: ROUTE_PATHS.run }),
      }),
      Object.freeze({
        id: "nav:explore",
        label: "Explore",
        description: "Open Explore.",
        keywords: Object.freeze(["go", "open", "explore", "library"]),
        category: "navigation",
        action: Object.freeze({ kind: CommandPaletteActionKinds.navigate, launchPath: ROUTE_PATHS.explore }),
      }),
      Object.freeze({
        id: "nav:data",
        label: "Data",
        description: "Open Data Studio.",
        keywords: Object.freeze(["go", "open", "data", "dataset", "dataset studio"]),
        category: "navigation",
        action: Object.freeze({ kind: CommandPaletteActionKinds.navigate, launchPath: ROUTE_PATHS.datasetStudio }),
      }),
      Object.freeze({
        id: "nav:manage",
        label: "Manage",
        description: "Open Manage.",
        keywords: Object.freeze(["go", "open", "manage", "settings"]),
        category: "navigation",
        action: Object.freeze({ kind: CommandPaletteActionKinds.navigate, launchPath: ROUTE_PATHS.settings }),
      }),
    ]);
  }
}

export class CommandPaletteService {
  private readonly resolver = new CommandPaletteEntryResolver();

  public resolveModel(_context: CommandPaletteContext, query: CommandPaletteQuery): CommandPaletteModel {
    const entries = this.resolver.resolveEntries();
    return Object.freeze({
      placeholder: "Jump to Build, Run, Explore, Data, or Manage",
      entries: toScoredEntries(entries, query.searchText),
    });
  }

  public resolveDefaultModel(context: CommandPaletteContext): CommandPaletteModel {
    return this.resolveModel(context, { searchText: "" });
  }
}

export class GlobalCommandTrigger {
  public isOpenCommand(event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">): boolean {
    if (event.altKey || event.shiftKey) {
      return false;
    }
    return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
  }
}
