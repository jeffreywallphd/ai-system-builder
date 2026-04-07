/**
 * NodeCategory is a lightweight domain value object plus a curated catalog
 * of well-known workflow node categories.
 *
 * Goals:
 * - provide normalized category handling without forcing a brittle enum
 * - support both built-in and custom/plugin categories
 * - give UI and filtering code stable grouping helpers
 * - stay domain-safe and engine-agnostic
 */

export type KnownNodeCategory =
  | "input"
  | "output"
  | "generation"
  | "language"
  | "vision"
  | "audio"
  | "video"
  | "multimodal"
  | "embedding"
  | "search"
  | "agent"
  | "control"
  | "routing"
  | "data"
  | "transform"
  | "conditioning"
  | "model"
  | "utility"
  | "custom";

const KNOWN_CATEGORY_SET: ReadonlySet<KnownNodeCategory> = new Set([
  "input",
  "output",
  "generation",
  "language",
  "vision",
  "audio",
  "video",
  "multimodal",
  "embedding",
  "search",
  "agent",
  "control",
  "routing",
  "data",
  "transform",
  "conditioning",
  "model",
  "utility",
  "custom",
]);

const CATEGORY_ALIAS_MAP: Readonly<Record<string, KnownNodeCategory>> = Object.freeze({
  input: "input",
  inputs: "input",
  source: "input",
  sources: "input",
  ingestion: "input",

  output: "output",
  outputs: "output",
  sink: "output",
  sinks: "output",
  export: "output",

  generation: "generation",
  generator: "generation",
  generative: "generation",

  language: "language",
  llm: "language",
  text: "language",
  chat: "language",

  vision: "vision",
  image: "vision",
  images: "vision",

  audio: "audio",
  speech: "audio",
  voice: "audio",

  video: "video",

  multimodal: "multimodal",
  "multi-modal": "multimodal",

  embedding: "embedding",
  embeddings: "embedding",
  vector: "embedding",
  vectors: "embedding",

  search: "search",
  retrieval: "search",
  rag: "search",
  rerank: "search",
  reranking: "search",

  agent: "agent",
  agents: "agent",
  tools: "agent",
  tool: "agent",

  control: "control",
  orchestration: "control",
  workflow: "control",

  routing: "routing",
  router: "routing",
  branching: "routing",

  data: "data",
  dataset: "data",
  document: "data",
  documents: "data",

  transform: "transform",
  transforms: "transform",
  processing: "transform",
  processor: "transform",

  conditioning: "conditioning",
  prompt: "conditioning",
  prompts: "conditioning",

  model: "model",
  models: "model",

  utility: "utility",
  utilities: "utility",
  helper: "utility",
  helpers: "utility",

  custom: "custom",
  plugin: "custom",
  plugins: "custom",
});

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, "-");
}

export class NodeCategory {
  public static readonly INPUT = new NodeCategory("input");
  public static readonly OUTPUT = new NodeCategory("output");
  public static readonly GENERATION = new NodeCategory("generation");
  public static readonly LANGUAGE = new NodeCategory("language");
  public static readonly VISION = new NodeCategory("vision");
  public static readonly AUDIO = new NodeCategory("audio");
  public static readonly VIDEO = new NodeCategory("video");
  public static readonly MULTIMODAL = new NodeCategory("multimodal");
  public static readonly EMBEDDING = new NodeCategory("embedding");
  public static readonly SEARCH = new NodeCategory("search");
  public static readonly AGENT = new NodeCategory("agent");
  public static readonly CONTROL = new NodeCategory("control");
  public static readonly ROUTING = new NodeCategory("routing");
  public static readonly DATA = new NodeCategory("data");
  public static readonly TRANSFORM = new NodeCategory("transform");
  public static readonly CONDITIONING = new NodeCategory("conditioning");
  public static readonly MODEL = new NodeCategory("model");
  public static readonly UTILITY = new NodeCategory("utility");
  public static readonly CUSTOM = new NodeCategory("custom");

  public readonly value: string;

  constructor(value: string) {
    const normalized = NodeCategory.normalize(value);

    if (!normalized) {
      throw new Error("NodeCategory cannot be empty.");
    }

    this.value = normalized;
  }

  public equals(other: NodeCategory | string | undefined | null): boolean {
    if (!other) {
      return false;
    }

    const otherValue = typeof other === "string" ? other : other.value;
    return this.value === NodeCategory.normalize(otherValue);
  }

  public isKnown(): boolean {
    return NodeCategory.isKnown(this.value);
  }

  public isCustom(): boolean {
    return this.value === "custom" || !this.isKnown();
  }

  public toString(): string {
    return this.value;
  }

  public static normalize(value: string): string {
    const normalized = normalize(value);
    return CATEGORY_ALIAS_MAP[normalized] ?? normalized;
  }

  public static create(value: string): NodeCategory {
    return new NodeCategory(value);
  }

  public static from(value: string | NodeCategory): NodeCategory {
    return value instanceof NodeCategory ? value : new NodeCategory(value);
  }

  public static isKnown(value: string): value is KnownNodeCategory {
    return KNOWN_CATEGORY_SET.has(
      NodeCategory.normalize(value) as KnownNodeCategory
    );
  }

  public static toKnown(value: string): KnownNodeCategory | undefined {
    const normalized = NodeCategory.normalize(value);
    return NodeCategory.isKnown(normalized) ? normalized : undefined;
  }

  public static matches(
    left: string | NodeCategory | undefined | null,
    right: string | NodeCategory | undefined | null
  ): boolean {
    if (!left || !right) {
      return false;
    }

    const leftValue = left instanceof NodeCategory ? left.value : left;
    const rightValue = right instanceof NodeCategory ? right.value : right;

    return NodeCategory.normalize(leftValue) === NodeCategory.normalize(rightValue);
  }

  public static anyOf(
    value: string | NodeCategory | undefined | null,
    candidates: ReadonlyArray<string | NodeCategory>
  ): boolean {
    if (!value) {
      return false;
    }

    return candidates.some((candidate) => NodeCategory.matches(value, candidate));
  }

  public static values(): ReadonlyArray<KnownNodeCategory> {
    return Object.freeze([...KNOWN_CATEGORY_SET]);
  }
}
