import { BuildEntryService } from "./BuildEntry";
import { BuildIntents, type BuildIntent } from "./BuildIntentModels";
import { ContextNavigationService } from "./ContextNavigation";
import { ROUTE_PATHS } from "./RouteConfig";
import { RunInterfaceService } from "./RunInterface";

export const CommandPaletteActionKinds = Object.freeze({
  navigate: "navigate",
  launchBuildIntent: "launch-build-intent",
  openAsset: "open-asset",
  runAction: "run-action",
});

export type CommandPaletteActionKind = typeof CommandPaletteActionKinds[keyof typeof CommandPaletteActionKinds];

export interface CommandPaletteAction {
  readonly kind: CommandPaletteActionKind;
  readonly launchPath: string;
  readonly intent?: BuildIntent;
}

export interface CommandPaletteEntry {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly keywords: ReadonlyArray<string>;
  readonly category: "navigation" | "build" | "context" | "run";
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

const buildIntentCommandMap: Readonly<Record<BuildIntent, { readonly label: string; readonly keywords: ReadonlyArray<string> }>> = Object.freeze({
  [BuildIntents.automateTask]: Object.freeze({ label: "Start automation flow", keywords: Object.freeze(["build", "automation", "workflow"]) }),
  [BuildIntents.createAiAssistant]: Object.freeze({ label: "Create an AI assistant", keywords: Object.freeze(["assistant", "agent", "build"]) }),
  [BuildIntents.trainModel]: Object.freeze({ label: "Start model training", keywords: Object.freeze(["train", "model", "build"]) }),
  [BuildIntents.workWithData]: Object.freeze({ label: "Start data workflow", keywords: Object.freeze(["data", "pipeline", "build"]) }),
  [BuildIntents.startFromScratch]: Object.freeze({ label: "Open a blank build canvas", keywords: Object.freeze(["blank", "scratch", "build"]) }),
});

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
  private readonly buildEntryService = new BuildEntryService();
  private readonly runInterfaceService = new RunInterfaceService();
  private readonly contextNavigationService = new ContextNavigationService();

  public resolveEntries(context: CommandPaletteContext): ReadonlyArray<CommandPaletteEntry> {
    const flowContext = this.contextNavigationService.resolve({ pathname: context.pathname, search: context.search }).flowContext;

    const navEntries: ReadonlyArray<CommandPaletteEntry> = Object.freeze([
      Object.freeze({
        id: "nav:build",
        label: "Go to Build",
        description: "Open Build in the primary intent navigation shell.",
        keywords: Object.freeze(["go", "open", "build"]),
        category: "navigation",
        action: Object.freeze({ kind: CommandPaletteActionKinds.navigate, launchPath: this.buildEntryService.resolveBuildEntryRoute() }),
      }),
      Object.freeze({
        id: "nav:explore",
        label: "Go to Explore",
        description: "Open Explore in the primary intent navigation shell.",
        keywords: Object.freeze(["go", "open", "explore", "library"]),
        category: "navigation",
        action: Object.freeze({ kind: CommandPaletteActionKinds.navigate, launchPath: ROUTE_PATHS.explore }),
      }),
      Object.freeze({
        id: "nav:run",
        label: "Go to Run",
        description: "Open Run in the primary intent navigation shell.",
        keywords: Object.freeze(["go", "open", "run", "test"]),
        category: "navigation",
        action: Object.freeze({ kind: CommandPaletteActionKinds.navigate, launchPath: ROUTE_PATHS.run }),
      }),
    ]);

    const buildEntries = this.buildEntryService
      .getLandingModel()
      .options
      .map((option) => {
        const launchContext = this.buildEntryService.resolveIntentLaunchContext({
          selection: { intent: option.intent, selectedAtIso: new Date().toISOString() },
          entryContext: { source: "intent" },
        });
        const copy = buildIntentCommandMap[option.intent];
        return Object.freeze({
          id: `build-intent:${option.intent}`,
          label: copy?.label ?? option.label,
          description: option.description,
          keywords: copy?.keywords ?? Object.freeze(["build", option.label.toLowerCase()]),
          category: "build" as const,
          action: Object.freeze({ kind: CommandPaletteActionKinds.launchBuildIntent, launchPath: launchContext.launchPath, intent: option.intent }),
        });
      });

    const runEntries: CommandPaletteEntry[] = [
      Object.freeze({
        id: "run:run-now",
        label: "Run from current context",
        description: "Open Run with the current shell context preselected.",
        keywords: Object.freeze(["run", "execute", "test"]),
        category: "run",
        action: Object.freeze({
          kind: CommandPaletteActionKinds.runAction,
          launchPath: this.runInterfaceService.resolveLaunchPath({ contextKind: "general", source: "direct", actionKind: "run", originPath: context.pathname }),
        }),
      }),
      Object.freeze({
        id: "run:test-now",
        label: "Test from current context",
        description: "Open Run in test mode without leaving intent navigation.",
        keywords: Object.freeze(["test", "validate", "run"]),
        category: "run",
        action: Object.freeze({
          kind: CommandPaletteActionKinds.runAction,
          launchPath: this.runInterfaceService.resolveLaunchPath({ contextKind: "general", source: "direct", actionKind: "test", originPath: context.pathname }),
        }),
      }),
    ];

    const contextualEntries: CommandPaletteEntry[] = [];
    if (flowContext.assetId) {
      contextualEntries.push(Object.freeze({
        id: `context:asset:${flowContext.assetId}`,
        label: "Open current asset",
        description: `Open asset ${flowContext.assetId} in Explore detail.`,
        keywords: Object.freeze(["asset", "explore", "open"]),
        category: "context",
        action: Object.freeze({ kind: CommandPaletteActionKinds.openAsset, launchPath: `/studio-shell/registry/assets/${encodeURIComponent(flowContext.assetId)}` }),
      }));
    }

    if (context.pathname.startsWith("/studio-shell/registry/assets/")) {
      contextualEntries.push(Object.freeze({
        id: "context:asset:return",
        label: "Back to Explore results",
        description: "Return to your Explore result set.",
        keywords: Object.freeze(["back", "return", "explore"]),
        category: "context",
        action: Object.freeze({ kind: CommandPaletteActionKinds.navigate, launchPath: ROUTE_PATHS.explore }),
      }));
    }

    return Object.freeze([...navEntries, ...buildEntries, ...contextualEntries, ...runEntries]);
  }
}

export class CommandPaletteService {
  private readonly resolver = new CommandPaletteEntryResolver();

  public resolveModel(context: CommandPaletteContext, query: CommandPaletteQuery): CommandPaletteModel {
    const entries = this.resolver.resolveEntries(context);
    return Object.freeze({
      placeholder: "Search actions…",
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
