require("dotenv").config();
const http = require("http");
const { exec } = require("child_process");
const path = require("path");

const PORT = Number(process.env.DEV_SYNC_PORT || 8787);
const HOST = process.env.DEV_SYNC_HOST || "0.0.0.0";
const TOKEN = process.env.DEV_SYNC_TOKEN || "ai-loom-dev-sync";
const REPO_DIR = path.resolve(process.env.DEV_SYNC_REPO_DIR || process.cwd());

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
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function runPull() {
  return new Promise((resolve) => {
    exec("git pull", { cwd: REPO_DIR }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: stdout || "",
        stderr: stderr || "",
        exitCode: error && typeof error.code === "number" ? error.code : 0,
      });
    });
  });
}

function runStatus() {
  return new Promise((resolve) => {
    exec("git rev-parse --short HEAD", { cwd: REPO_DIR }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        commit: stdout ? stdout.trim() : undefined,
        stderr: stderr || "",
      });
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { ok: false, message: "Missing request URL." });
    return;
  }

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.url === "/health" && req.method === "GET") {
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
    const requestToken = req.headers["x-dev-sync-token"];

    if (requestToken !== TOKEN) {
      sendJson(res, 401, {
        ok: false,
        message: "Unauthorized.",
      });
      return;
    }

    try {
      await parseRequestBody(req);
      const result = await runPull();

      sendJson(res, result.ok ? 200 : 500, {
        ok: result.ok,
        repoDir: REPO_DIR,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        message: error instanceof Error ? error.message : "Invalid request.",
      });
    }

    return;
  }

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
