import process from "node:process";

export function logInitializationStart(phase: string): number {
  const startedAt = Date.now();
  console.info(`\n[ai-loom][init] ${phase}:start startedAt=${new Date(startedAt).toISOString()}\n`);
  return startedAt;
}

export function logInitializationEnd(phase: string, startedAt: number): void {
  const endedAt = Date.now();
  console.info(
    `\n[ai-loom][init] ${phase}:end durationMs=${endedAt - startedAt} startedAt=${new Date(startedAt).toISOString()} endedAt=${new Date(endedAt).toISOString()}\n`,
  );
}

export function logInitializationCheckpoint(phase: string, checkpoint: string, startedAt: number): void {
  const now = Date.now();
  console.info(`\n[ai-loom][init] ${phase}:checkpoint name=${checkpoint} elapsedMs=${now - startedAt} at=${new Date(now).toISOString()}\n`);
}

export function logInitializationMemory(phase: string, checkpoint: string): void {
  const usage = process.memoryUsage();
  console.info(
    `\n[ai-loom][memory] ${phase}:checkpoint name=${checkpoint} rssMB=${toMegabytes(usage.rss)} heapUsedMB=${toMegabytes(usage.heapUsed)} heapTotalMB=${toMegabytes(usage.heapTotal)} externalMB=${toMegabytes(usage.external)} arrayBuffersMB=${toMegabytes(usage.arrayBuffers)} at=${new Date().toISOString()}\n`,
  );
}

function toMegabytes(value: number): string {
  return (value / (1024 * 1024)).toFixed(1);
}
