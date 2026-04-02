import { useEffect, useMemo, useState } from "react";
import type { StudioShellExtensionContext } from "../../../studio-shell/StudioShellExtensions";
import {
  serializeSystemStudioSettings,
  parseSystemStudioDraftDocument,
} from "../../../studio-shell/system/SystemStudioDraftDocument";
import {
  SystemNavigationModes,
  type SystemNavigationMode,
} from "../../../studio-shell/system/SystemSettingsModel";

interface SystemSettingsEditorProps {
  readonly context: StudioShellExtensionContext;
}

export function SystemSettingsEditor({ context }: SystemSettingsEditorProps): JSX.Element {
  const draft = context.snapshot?.draft;
  const sessionId = context.snapshot?.activeSessionId;
  const parsed = useMemo(
    () => parseSystemStudioDraftDocument(draft?.content ?? ""),
    [draft?.content],
  );
  const pages = parsed.systemSpec.pages;
  const settings = parsed.systemSpec.settings;

  const [systemName, setSystemName] = useState(settings.systemName);
  const [systemDescription, setSystemDescription] = useState(settings.systemDescription);
  const [defaultLandingPageId, setDefaultLandingPageId] = useState(settings.defaultLandingPageId ?? "");
  const [navigationMode, setNavigationMode] = useState<SystemNavigationMode>(settings.navigation.mode);
  const [themePresetId, setThemePresetId] = useState(settings.theme.presetId ?? "");
  const [themeTokenSetId, setThemeTokenSetId] = useState(settings.theme.tokenSetId ?? "");
  const [confirmBeforeExit, setConfirmBeforeExit] = useState(settings.runtimeBehavior.confirmBeforeExit);
  const [showHelpTips, setShowHelpTips] = useState(settings.runtimeBehavior.showHelpTips);
  const [rememberLastPage, setRememberLastPage] = useState(settings.runtimeBehavior.rememberLastPage);

  useEffect(() => {
    setSystemName(settings.systemName);
    setSystemDescription(settings.systemDescription);
    setDefaultLandingPageId(settings.defaultLandingPageId ?? "");
    setNavigationMode(settings.navigation.mode);
    setThemePresetId(settings.theme.presetId ?? "");
    setThemeTokenSetId(settings.theme.tokenSetId ?? "");
    setConfirmBeforeExit(settings.runtimeBehavior.confirmBeforeExit);
    setShowHelpTips(settings.runtimeBehavior.showHelpTips);
    setRememberLastPage(settings.runtimeBehavior.rememberLastPage);
  }, [draft?.draftId, draft?.revision, settings]);

  const saveSettings = (): void => {
    if (!draft || !sessionId) {
      return;
    }
    const next = serializeSystemStudioSettings({
      existingContent: draft.content,
      settings: {
        systemName,
        systemDescription,
        defaultLandingPageId: defaultLandingPageId.trim() || undefined,
        navigation: {
          mode: navigationMode,
        },
        theme: {
          presetId: themePresetId.trim() || undefined,
          tokenSetId: themeTokenSetId.trim() || undefined,
        },
        runtimeBehavior: {
          confirmBeforeExit,
          showHelpTips,
          rememberLastPage,
        },
      },
    });
    context.operations.setDraftContent?.(next);
  };

  return (
    <div className="ui-stack ui-stack--sm" data-testid="system-settings-editor">
      <div className="ui-stack ui-stack--2xs">
        <strong>System settings</strong>
        <p className="ui-text-small ui-text-secondary">
          Set global defaults for this system experience. Keep this focused on system-wide behavior.
        </p>
      </div>

      <div className="ui-form-grid">
        <label className="ui-field">
          <span className="ui-field__label">System name</span>
          <input className="ui-input" value={systemName} onChange={(event) => setSystemName(event.target.value)} />
        </label>
        <label className="ui-field">
          <span className="ui-field__label">System description</span>
          <input className="ui-input" value={systemDescription} onChange={(event) => setSystemDescription(event.target.value)} />
        </label>
        <label className="ui-field">
          <span className="ui-field__label">Default landing screen</span>
          <select className="ui-input" value={defaultLandingPageId} onChange={(event) => setDefaultLandingPageId(event.target.value)}>
            <option value="">Use first screen</option>
            {pages.map((page) => (
              <option key={page.pageId} value={page.pageId}>
                {page.title}
              </option>
            ))}
          </select>
        </label>
        <label className="ui-field">
          <span className="ui-field__label">Navigation style</span>
          <select className="ui-input" value={navigationMode} onChange={(event) => setNavigationMode(event.target.value as SystemNavigationMode)}>
            <option value={SystemNavigationModes.top}>Top navigation</option>
            <option value={SystemNavigationModes.side}>Side navigation</option>
            <option value={SystemNavigationModes.hidden}>Guided flow (hide navigation)</option>
          </select>
        </label>
      </div>

      <div className="ui-form-grid">
        <label className="ui-field">
          <span className="ui-field__label">Theme preset (optional)</span>
          <input className="ui-input" value={themePresetId} onChange={(event) => setThemePresetId(event.target.value)} placeholder="Example: neutral-light" />
        </label>
        <label className="ui-field">
          <span className="ui-field__label">Theme token set (optional)</span>
          <input className="ui-input" value={themeTokenSetId} onChange={(event) => setThemeTokenSetId(event.target.value)} placeholder="Example: tokens-v1" />
        </label>
      </div>

      <div className="ui-form-grid">
        <label className="ui-field">
          <span className="ui-field__label">Ask before leaving unsaved work</span>
          <input type="checkbox" className="ui-checkbox" checked={confirmBeforeExit} onChange={(event) => setConfirmBeforeExit(event.target.checked)} />
        </label>
        <label className="ui-field">
          <span className="ui-field__label">Show in-app help tips</span>
          <input type="checkbox" className="ui-checkbox" checked={showHelpTips} onChange={(event) => setShowHelpTips(event.target.checked)} />
        </label>
        <label className="ui-field">
          <span className="ui-field__label">Return to last opened screen</span>
          <input type="checkbox" className="ui-checkbox" checked={rememberLastPage} onChange={(event) => setRememberLastPage(event.target.checked)} />
        </label>
      </div>

      <details className="ui-card ui-card--padded ui-stack ui-stack--2xs">
        <summary className="ui-text-small">Advanced technical settings</summary>
        <p className="ui-text-small ui-text-secondary">
          System parameters are available for deeper runtime wiring. Most teams can leave these unchanged at first.
        </p>
      </details>

      <div className="ui-row ui-row--end">
        <button className="ui-button" disabled={!draft || !sessionId || context.isBusy} onClick={saveSettings}>
          Save settings
        </button>
      </div>
    </div>
  );
}

export default SystemSettingsEditor;
