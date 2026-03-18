import { useEffect, useState } from "react";
import { useUiDependencies } from "../composition/AppProviders";
import type { UiSettingsState } from "../settings/UiSettingsStore";

interface DevSyncResponse {
  readonly ok: boolean;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly message?: string;
}

export default function DevSyncButton(): JSX.Element | null {
  const { config, settingsStore } = useUiDependencies();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>();
  const [settingsState, setSettingsState] = useState<UiSettingsState>(() => settingsStore.getState());

  useEffect(() => settingsStore.subscribe(setSettingsState), [settingsStore]);

  const devSyncBaseUrl = settingsState.settings.development.devSyncBaseUrl.trim();
  const devSyncToken = settingsState.settings.development.devSyncToken.trim();

  if (config.isProductionMode || !devSyncBaseUrl) {
    return null;
  }

  const syncNow = async (): Promise<void> => {
    setIsSyncing(true);
    setLastMessage(undefined);

    try {
      const response = await fetch(`${devSyncBaseUrl}/sync/pull`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(devSyncToken
            ? { "X-Dev-Sync-Token": devSyncToken }
            : {}),
        },
        body: JSON.stringify({
          triggeredAt: new Date().toISOString(),
        }),
      });

      const payload = (await response.json()) as DevSyncResponse;

      if (!response.ok || !payload.ok) {
        setLastMessage(payload.stderr || payload.message || "Sync failed.");
        return;
      }

      const summary = payload.stdout?.trim() || "Sync complete.";
      setLastMessage(summary);
    } catch (error) {
      setLastMessage(
        error instanceof Error ? error.message : "Unable to reach sync agent."
      );
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="ui-row ui-row--wrap">
      <button
        type="button"
        className={`ui-button ui-button--secondary ui-button--sm${
          isSyncing ? " ui-button--loading" : ""
        }`}
        onClick={() => {
          void syncNow();
        }}
        title={lastMessage}
      >
        <span className="ui-button__label">
          {isSyncing ? <span className="ui-button__spinner" aria-hidden="true" /> : null}
          Sync PC
        </span>
      </button>

      {lastMessage ? (
        <span className="ui-text-small ui-subtle" style={{ maxWidth: "22rem" }}>
          {lastMessage}
        </span>
      ) : null}
    </div>
  );
}
