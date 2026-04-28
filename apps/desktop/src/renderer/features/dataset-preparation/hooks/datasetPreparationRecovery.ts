import type { DesktopPythonRuntimeStatusSnapshot } from "../../../lib/desktopApi";

type RecoveryTerminalState = "succeeded" | "failed" | "stopped";

interface ParsedRuntimeEvent {
  event?: string;
  requestId?: string;
  status?: string;
  message?: string;
  error?: { message?: string };
}

export interface MatchingDatasetPreparationTaskSnapshot {
  matchingTaskObserved: boolean;
  matchingTaskActive: boolean;
  terminalState?: RecoveryTerminalState;
  terminalMessage?: string;
}

function parseJsonLogLine(line: string): ParsedRuntimeEvent | undefined {
  const jsonStart = line.indexOf("{");
  if (jsonStart < 0) {
    return undefined;
  }

  try {
    return JSON.parse(line.slice(jsonStart)) as ParsedRuntimeEvent;
  } catch {
    return undefined;
  }
}

function splitLogMessage(message: string): string[] {
  return message
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseTerminalStateFromEvent(event: ParsedRuntimeEvent): { state?: RecoveryTerminalState; message?: string } {
  if (event.event === "runtime.dataset_preparation.task.succeeded") {
    return { state: "succeeded", message: event.message };
  }
  if (event.event === "runtime.dataset_preparation.task.cancelled" || event.status === "cancelled") {
    return { state: "stopped", message: event.message };
  }
  if (event.event === "runtime.dataset_preparation.task.failed" || event.status === "failed") {
    return { state: "failed", message: event.error?.message ?? event.message };
  }

  return {};
}

export function identifyMatchingDatasetPreparationTask(
  snapshot: Pick<DesktopPythonRuntimeStatusSnapshot, "logs" | "activeTaskCount">,
  options: { requestId: string; sinceEpochMs?: number },
): MatchingDatasetPreparationTaskSnapshot {
  let matchingTaskObserved = false;
  let terminalState: RecoveryTerminalState | undefined;
  let terminalMessage: string | undefined;

  for (const log of snapshot.logs) {
    if (typeof options.sinceEpochMs === "number") {
      const logEpochMs = Date.parse(log.timestamp);
      if (Number.isFinite(logEpochMs) && logEpochMs < options.sinceEpochMs) {
        continue;
      }
    }

    for (const line of splitLogMessage(log.message)) {
      const payload = parseJsonLogLine(line);
      if (!payload || payload.requestId !== options.requestId) {
        continue;
      }

      const relevantEvent = payload.event?.startsWith("runtime.dataset_preparation.");
      if (!relevantEvent && payload.status !== "failed" && payload.status !== "cancelled") {
        continue;
      }

      matchingTaskObserved = true;
      const terminal = parseTerminalStateFromEvent(payload);
      if (terminal.state) {
        terminalState = terminal.state;
        terminalMessage = terminal.message;
      }
    }
  }

  const matchingTaskActive = matchingTaskObserved && !terminalState && snapshot.activeTaskCount > 0;
  return {
    matchingTaskObserved,
    matchingTaskActive,
    terminalState,
    terminalMessage,
  };
}

export function classifyRecoveredDatasetPreparationCompletion(
  match: MatchingDatasetPreparationTaskSnapshot,
): "succeeded" | "failed" | "stopped" | "unknown" | "still-running" | "unrelated-runtime-task" {
  if (match.terminalState) {
    return match.terminalState;
  }
  if (match.matchingTaskActive) {
    return "still-running";
  }
  if (match.matchingTaskObserved) {
    return "unknown";
  }
  return "unrelated-runtime-task";
}
