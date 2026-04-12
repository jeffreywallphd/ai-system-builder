import { listCommandPaletteRouteEntries } from "./SurfaceRouteMetadataCatalog";
import { UiSurfaceKeys, type SurfaceAvailabilityContext } from "../shared/navigation/SurfaceNavigationMetadata";

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
  public resolveEntries(
    availabilityContext: SurfaceAvailabilityContext = { surface: UiSurfaceKeys.desktopOperational },
  ): ReadonlyArray<CommandPaletteEntry> {
    return Object.freeze(
      listCommandPaletteRouteEntries(availabilityContext).map((entry) => Object.freeze({
        id: entry.id,
        label: entry.label,
        description: entry.description,
        keywords: entry.keywords,
        category: "navigation",
        action: Object.freeze({ kind: CommandPaletteActionKinds.navigate, launchPath: entry.launchPath }),
      })),
    );
  }
}

export class CommandPaletteService {
  private readonly resolver = new CommandPaletteEntryResolver();

  public resolveModel(
    _context: CommandPaletteContext,
    query: CommandPaletteQuery,
    availabilityContext: SurfaceAvailabilityContext = { surface: UiSurfaceKeys.desktopOperational },
  ): CommandPaletteModel {
    const entries = this.resolver.resolveEntries(availabilityContext);
    return Object.freeze({
      placeholder: "Jump to Build, Run, Explore, Data, Manage, or Identity admin",
      entries: toScoredEntries(entries, query.searchText),
    });
  }

  public resolveDefaultModel(
    context: CommandPaletteContext,
    availabilityContext: SurfaceAvailabilityContext = { surface: UiSurfaceKeys.desktopOperational },
  ): CommandPaletteModel {
    return this.resolveModel(context, { searchText: "" }, availabilityContext);
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
