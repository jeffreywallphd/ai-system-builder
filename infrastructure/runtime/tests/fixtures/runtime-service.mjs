import http from "node:http";

const port = Number(process.env.TEST_RUNTIME_PORT || 0);
const healthyAfterMs = Number(process.env.TEST_RUNTIME_HEALTHY_AFTER_MS || 0);
const crashAfterMs = Number(process.env.TEST_RUNTIME_CRASH_AFTER_MS || 0);
const stdoutMessage = process.env.TEST_RUNTIME_STDOUT_MESSAGE || "runtime stdout ready";
const stderrMessage = process.env.TEST_RUNTIME_STDERR_MESSAGE || "runtime stderr ready";
const gracefulShutdownDelayMs = Number(process.env.TEST_RUNTIME_GRACEFUL_SHUTDOWN_DELAY_MS || 0);
const startedAt = Date.now();

console.log(stdoutMessage);
console.error(stderrMessage);

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    const healthy = Date.now() - startedAt >= healthyAfterMs;
    res.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: healthy ? "ok" : "starting" }));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("ok");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`listening:${port}`);
});

process.on("SIGTERM", () => {
  console.log("received-sigterm");
  setTimeout(() => {
    server.close(() => {
      console.log("shutdown-complete");
      process.exit(0);
    });
  }, gracefulShutdownDelayMs);
});

if (crashAfterMs > 0) {
  setTimeout(() => {
    console.error("crashing-during-startup");
    process.exit(12);
  }, crashAfterMs);
}
