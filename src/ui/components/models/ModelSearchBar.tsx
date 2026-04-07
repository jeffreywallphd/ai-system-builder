import { useEffect, useMemo, useState } from "react";

export interface ModelSearchBarValue {
  readonly query: string;
  readonly provider?: string;
  readonly mode?: "remote" | "installed" | "all";
  readonly kind?: string;
  readonly runtime?: string;
}

export interface ModelSearchBarProps {
  readonly value?: Partial<ModelSearchBarValue>;
  readonly isBusy?: boolean;
  readonly providerOptions?: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  readonly kindOptions?: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  readonly runtimeOptions?: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  readonly modeOptions?: ReadonlyArray<{
    readonly value: "remote" | "installed" | "all";
    readonly label: string;
  }>;
  readonly onSearch: (value: ModelSearchBarValue) => void;
  readonly onClear?: () => void;
}

const defaultProviders = Object.freeze([
  Object.freeze({ value: "huggingface", label: "Hugging Face" }),
]);

const defaultKinds = Object.freeze([
  Object.freeze({ value: "completion-model", label: "Completion" }),
  Object.freeze({ value: "foundation-model", label: "Foundation" }),
  Object.freeze({ value: "embedding-model", label: "Embedding" }),
  Object.freeze({ value: "image-generation-model", label: "Image Generation" }),
  Object.freeze({ value: "video-generation-model", label: "Video Generation" }),
  Object.freeze({ value: "speech-to-text-model", label: "Speech to Text" }),
  Object.freeze({ value: "text-to-speech-model", label: "Text to Speech" }),
  Object.freeze({ value: "multimodal-model", label: "Multimodal" }),
]);

const defaultRuntimes = Object.freeze([
  Object.freeze({ value: "comfyui", label: "ComfyUI" }),
  Object.freeze({ value: "transformers", label: "Transformers" }),
  Object.freeze({ value: "diffusers", label: "Diffusers" }),
  Object.freeze({ value: "generic", label: "Generic" }),
]);

const defaultModes = Object.freeze([
  Object.freeze({ value: "remote" as const, label: "Remote" }),
  Object.freeze({ value: "installed" as const, label: "Installed" }),
  Object.freeze({ value: "all" as const, label: "All" }),
]);

export default function ModelSearchBar({
  value,
  isBusy,
  providerOptions = defaultProviders,
  kindOptions = defaultKinds,
  runtimeOptions = defaultRuntimes,
  modeOptions = defaultModes,
  onSearch,
  onClear,
}: ModelSearchBarProps): JSX.Element {
  const initial = useMemo<ModelSearchBarValue>(
    () => ({
      query: value?.query ?? "",
      provider: value?.provider,
      mode: value?.mode ?? "all",
      kind: value?.kind,
      runtime: value?.runtime,
    }),
    [value]
  );

  const [form, setForm] = useState<ModelSearchBarValue>(initial);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const update = <K extends keyof ModelSearchBarValue>(
    key: K,
    nextValue: ModelSearchBarValue[K]
  ): void => {
    setForm((current) => ({
      ...current,
      [key]: nextValue,
    }));
  };

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    onSearch({
      query: form.query.trim(),
      provider: form.provider || undefined,
      mode: form.mode,
      kind: form.kind || undefined,
      runtime: form.runtime || undefined,
    });
  };

  const clear = (): void => {
    const cleared: ModelSearchBarValue = {
      query: "",
      provider: undefined,
      mode: "all",
      kind: undefined,
      runtime: undefined,
    };

    setForm(cleared);
    onClear?.();
  };

  return (
    <form className="ui-stack ui-stack--sm" onSubmit={submit}>
      <div className="ui-model-search__row">
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="model-search-query">
            Search
          </label>
          <input
            id="model-search-query"
            className="ui-input"
            type="text"
            value={form.query}
            placeholder="Search models, families, tags, or publishers"
            onChange={(event) => update("query", event.target.value)}
            disabled={isBusy}
          />
        </div>

        <div className="ui-field">
          <label className="ui-field__label" htmlFor="model-search-provider">
            Provider
          </label>
          <select
            id="model-search-provider"
            className="ui-select"
            value={form.provider ?? ""}
            onChange={(event) => update("provider", event.target.value || undefined)}
            disabled={isBusy}
          >
            <option value="">Any</option>
            {providerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <button
          className={`ui-button ui-button--primary ui-button--md${
            isBusy ? " ui-button--loading" : ""
          }`}
          type="submit"
          disabled={isBusy}
        >
          <span className="ui-button__label">
            {isBusy ? <span className="ui-button__spinner" aria-hidden="true" /> : null}
            Search
          </span>
        </button>

        <button
          className="ui-button ui-button--secondary ui-button--md"
          type="button"
          onClick={clear}
          disabled={isBusy}
        >
          Clear
        </button>
      </div>

      <div className="ui-row ui-row--wrap">
        <div className="ui-field" style={{ minWidth: "160px", flex: "1 1 160px" }}>
          <label className="ui-field__label" htmlFor="model-search-mode">
            Scope
          </label>
          <select
            id="model-search-mode"
            className="ui-select"
            value={form.mode ?? "all"}
            onChange={(event) =>
              update("mode", event.target.value as ModelSearchBarValue["mode"])
            }
            disabled={isBusy}
          >
            {modeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="ui-field" style={{ minWidth: "160px", flex: "1 1 160px" }}>
          <label className="ui-field__label" htmlFor="model-search-kind">
            Kind
          </label>
          <select
            id="model-search-kind"
            className="ui-select"
            value={form.kind ?? ""}
            onChange={(event) => update("kind", event.target.value || undefined)}
            disabled={isBusy}
          >
            <option value="">Any</option>
            {kindOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="ui-field" style={{ minWidth: "160px", flex: "1 1 160px" }}>
          <label className="ui-field__label" htmlFor="model-search-runtime">
            Runtime
          </label>
          <select
            id="model-search-runtime"
            className="ui-select"
            value={form.runtime ?? ""}
            onChange={(event) => update("runtime", event.target.value || undefined)}
            disabled={isBusy}
          >
            <option value="">Any</option>
            {runtimeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </form>
  );
}
