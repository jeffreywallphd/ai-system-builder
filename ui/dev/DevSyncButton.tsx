import { useState } from "react";
import { useUiDependencies } from "../composition/AppProviders";

interface DevSyncResponse {
  readonly ok: boolean;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly message?: string;
}

export default function DevSyncButton(): JSX.Element | null {
  const { config } = useUiDependencies();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>();

  if (!config.isDevSyncEnabled) {
    return null;
  }

  const syncNow = async (): Promise<void> => {
    setIsSyncing(true);
    setLastMessage(undefined);

    try {
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
