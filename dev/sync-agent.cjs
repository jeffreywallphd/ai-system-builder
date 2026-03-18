require("dotenv").config();
const http = require("http");
const { exec, execFile } = require("child_process");
const path = require("path");

const PORT = Number(process.env.DEV_SYNC_PORT || 8787);
const HOST = process.env.DEV_SYNC_HOST || "0.0.0.0";
const TOKEN = process.env.DEV_SYNC_TOKEN || "ai-loom-dev-sync";
const REPO_DIR = path.resolve(process.env.DEV_SYNC_REPO_DIR || process.cwd());

console.log("[dev-sync-agent] Starting...");
console.log("[dev-sync-agent] Repo directory:", REPO_DIR);
console.log("[dev-sync-agent] Host:", HOST);
console.log("[dev-sync-agent] Port:", PORT);

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Dev-Sync-Token",
  });

  res.end(body);
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
    });

    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        console.error("[dev-sync-agent] JSON parse error:", error);
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function normalizePathList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function extractOverwrittenFiles(output) {
  if (!output) {
    return [];
  }

  const lines = output.split(/\r?\n/);
  const startIndex = lines.findIndex((line) =>
    /would be overwritten by merge:/i.test(line)
  );

  if (startIndex === -1) {
    return [];
  }

  const inlineMatch = lines[startIndex].match(/would be overwritten by merge:\s*(.+)$/i);
  const files = [];

  if (inlineMatch?.[1]) {
    files.push(inlineMatch[1].trim());
  }

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    if (
      /^please\s+/i.test(trimmed) ||
      /^aborting\b/i.test(trimmed) ||
      /^updating\s+/i.test(trimmed) ||
      /^merge\s+/i.test(trimmed)
    ) {
      break;
    }

    files.push(trimmed);
  }

  return [...new Set(files)];
}

function buildPullResponse(error, stdout, stderr) {
  const normalizedStdout = stdout || "";
  const normalizedStderr = stderr || "";
  const combinedOutput = `${normalizedStdout}\n${normalizedStderr}`;
  const overwrittenFiles = extractOverwrittenFiles(combinedOutput);

  return {
    ok: !error,
    stdout: normalizedStdout,
    stderr: normalizedStderr,
    exitCode: error && typeof error.code === "number" ? error.code : 0,
    canStashAndRetry: overwrittenFiles.length > 0,
    overwrittenFiles,
  };
}

function runPull() {
  console.log("[dev-sync-agent] Running git pull...");

  return new Promise((resolve) => {
    exec("git pull", { cwd: REPO_DIR }, (error, stdout, stderr) => {
      if (error) {
        console.error("[dev-sync-agent] git pull failed");
      } else {
        console.log("[dev-sync-agent] git pull completed");
      }

      if (stdout) console.log("[git stdout]\n", stdout);
      if (stderr) console.log("[git stderr]\n", stderr);

      resolve(buildPullResponse(error, stdout, stderr));
    });
  });
}

function runStash(files) {
  console.log("[dev-sync-agent] Running git stash for files:", files);

  return new Promise((resolve) => {
    execFile(
      "git",
      [
        "stash",
        "push",
        "-m",
        `dev-sync auto-stash ${new Date().toISOString()}`,
        "--",
        ...files,
      ],
      { cwd: REPO_DIR },
      (error, stdout, stderr) => {
        if (error) {
          console.error("[dev-sync-agent] git stash failed");
        } else {
          console.log("[dev-sync-agent] git stash completed");
        }

        if (stdout) console.log("[git stash stdout]\n", stdout);
        if (stderr) console.log("[git stash stderr]\n", stderr);

        resolve({
          ok: !error,
          stdout: stdout || "",
          stderr: stderr || "",
          exitCode: error && typeof error.code === "number" ? error.code : 0,
        });
      }
    );
  });
}

function runStatus() {
  console.log("[dev-sync-agent] Checking git status...");

  return new Promise((resolve) => {
    exec(
      "git rev-parse --short HEAD",
      { cwd: REPO_DIR },
      (error, stdout, stderr) => {
        if (error) {
          console.error("[dev-sync-agent] git status failed");
        }

        const commit = stdout ? stdout.trim() : undefined;

        console.log("[dev-sync-agent] Current commit:", commit);

        resolve({
          ok: !error,
          commit,
          stderr: stderr || "",
        });
      }
    );
  });
}

const server = http.createServer(async (req, res) => {
  const time = new Date().toISOString();
  console.log(`[${time}] ${req.method} ${req.url}`);

  if (!req.url) {
    console.warn("[dev-sync-agent] Missing request URL");
    sendJson(res, 400, { ok: false, message: "Missing request URL." });
    return;
  }

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.url === "/health" && req.method === "GET") {
    console.log("[dev-sync-agent] Health check requested");

    const status = await runStatus();

    sendJson(res, 200, {
      ok: true,
      mode: "dev-sync-agent",
      repoDir: REPO_DIR,
      port: PORT,
      commit: status.commit,
    });

    return;
  }

  if (req.url === "/sync/pull" && req.method === "POST") {
    console.log("[dev-sync-agent] Sync pull requested");

    const requestToken = req.headers["x-dev-sync-token"];

    if (requestToken !== TOKEN) {
      console.warn("[dev-sync-agent] Unauthorized request attempt");
      sendJson(res, 401, {
        ok: false,
        message: "Unauthorized.",
      });
      return;
    }

    try {
      const body = await parseRequestBody(req);
      const requestedStashFiles = normalizePathList(body.stashFiles);

      if (requestedStashFiles.length > 0) {
        const stashResult = await runStash(requestedStashFiles);

        if (!stashResult.ok) {
          sendJson(res, 500, {
            ok: false,
            repoDir: REPO_DIR,
            stdout: stashResult.stdout,
            stderr: stashResult.stderr,
            exitCode: stashResult.exitCode,
            stashAttempted: true,
            stashedFiles: requestedStashFiles,
          });
          return;
        }
      }

      const result = await runPull();

      console.log(
        `[dev-sync-agent] Pull finished. success=${result.ok} exitCode=${result.exitCode}`
      );

      sendJson(res, result.ok ? 200 : 500, {
        ok: result.ok,
        repoDir: REPO_DIR,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        canStashAndRetry: result.canStashAndRetry,
        overwrittenFiles: result.overwrittenFiles,
        stashAttempted: requestedStashFiles.length > 0,
        stashedFiles: requestedStashFiles,
      });
    } catch (error) {
      console.error("[dev-sync-agent] Request processing error:", error);

      sendJson(res, 400, {
        ok: false,
        message: error instanceof Error ? error.message : "Invalid request.",
      });
    }

    return;
  }

  console.warn("[dev-sync-agent] Unknown route:", req.url);

  sendJson(res, 404, {
    ok: false,
    message: "Not found.",
  });
});

server.listen(PORT, HOST, () => {
  console.log(
    `[dev-sync-agent] listening on http://${HOST}:${PORT} for repo ${REPO_DIR}`
  );
});
