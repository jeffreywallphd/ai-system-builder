import type { ContextInspectionResult } from "@application/context/models/ContextInspectionResult";

export interface ContextBudgetPanelProps {
  readonly inspection?: ContextInspectionResult;
  readonly visibilityMode: "basic" | "advanced";
  readonly maxCharacters?: number;
  readonly maxTokens?: number;
  readonly trimPartialFragments: boolean;
  readonly onVisibilityModeChange?: (value: "basic" | "advanced") => void;
  readonly onMaxCharactersChange?: (value?: number) => void;
  readonly onMaxTokensChange?: (value?: number) => void;
  readonly onTrimPartialFragmentsChange?: (value: boolean) => void;
}

function parseNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : undefined;
}

export default function ContextBudgetPanel({
  inspection,
  visibilityMode,
  maxCharacters,
  maxTokens,
  trimPartialFragments,
  onVisibilityModeChange,
  onMaxCharactersChange,
  onMaxTokensChange,
  onTrimPartialFragmentsChange,
}: ContextBudgetPanelProps): JSX.Element {
  const budgeting = inspection?.budgeting;

  return (
    <section className="ui-panel" data-testid="context-budget-panel">
      <div className="ui-panel__header">
        <div>
          <div className="ui-panel__title">Budget &amp; Trim Controls</div>
          <div className="ui-panel__subtitle">
            Tune author-facing visibility and budgets to see what survives the final execution envelope.
          </div>
        </div>
      </div>

      <div className="ui-panel__body ui-stack ui-stack--md">
        <div className="ui-meta-grid">
          <div className="ui-meta-item">
            <div className="ui-meta-label">Included chars</div>
            <div className="ui-meta-value">{budgeting?.includedCharacterCount ?? 0}</div>
          </div>
          <div className="ui-meta-item">
            <div className="ui-meta-label">Total chars</div>
            <div className="ui-meta-value">{budgeting?.totalCharacterCount ?? 0}</div>
          </div>
          <div className="ui-meta-item">
            <div className="ui-meta-label">Included tokens</div>
            <div className="ui-meta-value">{budgeting?.includedTokenCount ?? 0}</div>
          </div>
          <div className="ui-meta-item">
            <div className="ui-meta-label">Trimmed</div>
            <div className="ui-meta-value">{budgeting?.wasTrimmed ? "Yes" : "No"}</div>
          </div>
        </div>

        <div className="ui-grid ui-grid--2col" style={{ gap: "var(--ui-space-4)" }}>
          <div className="ui-field">
            <label className="ui-field__label" htmlFor="context-workbench-visibility-mode">Visible detail</label>
            <select
              id="context-workbench-visibility-mode"
              className="ui-select"
              value={visibilityMode}
              onChange={(event) => onVisibilityModeChange?.(event.target.value === "basic" ? "basic" : "advanced")}
            >
              <option value="advanced">Full author detail</option>
              <option value="basic">Reader-safe only</option>
            </select>
          </div>

          <div className="ui-field">
            <label className="ui-field__label" htmlFor="context-workbench-trim-partial">Allow partial fragment trim</label>
            <label className="ui-row ui-row--wrap" htmlFor="context-workbench-trim-partial">
              <input
                id="context-workbench-trim-partial"
                type="checkbox"
                checked={trimPartialFragments}
                onChange={(event) => onTrimPartialFragmentsChange?.(event.target.checked)}
              />
              <span>Shorten the last surviving fragment to fit.</span>
            </label>
          </div>

          <div className="ui-field">
            <label className="ui-field__label" htmlFor="context-workbench-max-characters">Character budget</label>
            <input
              id="context-workbench-max-characters"
              className="ui-input"
              type="number"
              min={0}
              step={1}
              value={maxCharacters ?? ""}
              onChange={(event) => onMaxCharactersChange?.(parseNumber(event.target.value))}
              placeholder="No limit"
            />
          </div>

          <div className="ui-field">
            <label className="ui-field__label" htmlFor="context-workbench-max-tokens">Token budget</label>
            <input
              id="context-workbench-max-tokens"
              className="ui-input"
              type="number"
              min={0}
              step={1}
              value={maxTokens ?? ""}
              onChange={(event) => onMaxTokensChange?.(parseNumber(event.target.value))}
              placeholder="No limit"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

