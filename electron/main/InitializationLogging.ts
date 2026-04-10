import process from "node:process";

export function logInitializationStart(phase: string): number {
  const startedAt = Date.now();
  console.info(`[ai-loom][startup] event=start phase=${phase} startedAt=${new Date(startedAt).toISOString()}`);
  return startedAt;
}

export function logInitializationEnd(phase: string, startedAt: number): void {
  const endedAt = Date.now();
  console.info(
    `[ai-loom][startup] event=end phase=${phase} durationMs=${endedAt - startedAt} startedAt=${new Date(startedAt).toISOString()} endedAt=${new Date(endedAt).toISOString()}`,
  );
}

export function logInitializationCheckpoint(phase: string, checkpoint: string, startedAt: number): void {
  const now = Date.now();
  console.info(
    `[ai-loom][startup] event=checkpoint phase=${phase} name=${checkpoint} elapsedMs=${now - startedAt} at=${new Date(now).toISOString()}`,
  );
}

export function logInitializationMemory(phase: string, checkpoint: string): void {
  const usage = process.memoryUsage();
  console.info(
    `[ai-loom][startup-memory] phase=${phase} name=${checkpoint} rssMB=${toMegabytes(usage.rss)} heapUsedMB=${toMegabytes(usage.heapUsed)} heapTotalMB=${toMegabytes(usage.heapTotal)} externalMB=${toMegabytes(usage.external)} arrayBuffersMB=${toMegabytes(usage.arrayBuffers)} at=${new Date().toISOString()}`,
  );
}

function toMegabytes(value: number): string {
  return (value / (1024 * 1024)).toFixed(1);
}
