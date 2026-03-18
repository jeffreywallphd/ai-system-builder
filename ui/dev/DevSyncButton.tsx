import { useState } from "react";
import { useUiDependencies } from "../composition/AppProviders";

interface DevSyncResponse {
  readonly ok: boolean;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly message?: string;
  readonly canStashAndRetry?: boolean;
  readonly overwrittenFiles?: readonly string[];
}

export default function DevSyncButton(): JSX.Element | null {
  const { config } = useUiDependencies();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>();

  if (!config.isDevSyncEnabled) {
    return null;
  }

  const requestSync = async (stashFiles?: readonly string[]): Promise<DevSyncResponse> => {
    const response = await fetch(`${config.devSyncBaseUrl}/sync/pull`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.devSyncToken
          ? { "X-Dev-Sync-Token": config.devSyncToken }
          : {}),
      },
      body: JSON.stringify({
        triggeredAt: new Date().toISOString(),
        ...(stashFiles && stashFiles.length > 0 ? { stashFiles } : {}),
      }),
    });

    const payload = (await response.json()) as DevSyncResponse;

    if (!response.ok || !payload.ok) {
      throw payload;
    }

    return payload;
  };

  const syncNow = async (): Promise<void> => {
    setIsSyncing(true);
    setLastMessage(undefined);

    try {
      const payload = await requestSync();
      const summary = payload.stdout?.trim() || "Sync complete.";
      setLastMessage(summary);
    } catch (error) {
      const payload = error as DevSyncResponse;
      const overwrittenFiles = payload.overwrittenFiles ?? [];
      const shouldPromptForStash =
        payload.canStashAndRetry === true && overwrittenFiles.length > 0;

      if (shouldPromptForStash) {
        const shouldStash = window.confirm(
          `Git pull would overwrite your local changes in:\n\n${overwrittenFiles.join(
            "\n"
          )}\n\nWould you like AI Loom to stash these files and try the pull again?`
        );

        if (shouldStash) {
          try {
            const retryPayload = await requestSync(overwrittenFiles);
            const retrySummary = retryPayload.stdout?.trim() || "Sync complete.";
            setLastMessage(
              `Stashed ${overwrittenFiles.join(", ")} and synced successfully. ${retrySummary}`
            );
            return;
          } catch (retryError) {
            const retryPayload = retryError as DevSyncResponse;
            setLastMessage(
              retryPayload.stderr || retryPayload.message || "Stash retry failed."
            );
            return;
          }
        }
      }

      setLastMessage(payload.stderr || payload.message || "Sync failed.");
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
