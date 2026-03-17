import {
  DEFAULT_TOOL_AUTOMATION_TYPES,
  type ToolAutomationType,
} from "../tools/ToolAutomationType";

interface ClassifierInput {
  readonly title: string;
  readonly description?: string;
  readonly category?: string;
}

export class ToolAutomationTypeClassifier {
  private readonly fallbackType: ToolAutomationType;

  constructor(
    private readonly supportedTypes: ReadonlyArray<ToolAutomationType> =
      DEFAULT_TOOL_AUTOMATION_TYPES
  ) {
    const fallback = this.supportedTypes.find((type) => type.id === "custom-automation");
    this.fallbackType =
      fallback ?? Object.freeze({ id: "custom-automation", label: "Custom Automation", keywords: Object.freeze([]) });
  }

  public listSupportedTypes(): ReadonlyArray<ToolAutomationType> {
    return this.supportedTypes;
  }

  public classify(input: ClassifierInput): ToolAutomationType {
    const searchable = `${input.title} ${input.description ?? ""} ${input.category ?? ""}`.toLowerCase();

    let winner = this.fallbackType;
    let bestScore = 0;

    for (const type of this.supportedTypes) {
      const score = type.keywords.reduce(
        (sum, keyword) => (searchable.includes(keyword) ? sum + 1 : sum),
        0
      );

      if (score > bestScore) {
        bestScore = score;
        winner = type;
      }
    }

    return winner;
  }
}
