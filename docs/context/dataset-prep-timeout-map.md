# Dataset Preparation Timeout/Disconnect Investigation (Evidence-First)

## Section A: Failure timeline

### A1) Current request path model (from this repo)

1. **Renderer feature starts dataset prep call** via `desktopApi.prepareTrainingDatasetFromArtifacts(...)` in the dataset-preparation transport/client path.  
2. **Preload bridge forwards to Electron IPC** using `ipcRenderer.invoke(...)` on `desktop.dataset.prepareTrainingDatasetFromArtifacts.request`.  
3. **Main process IPC handler** maps the request into `PrepareTrainingDatasetFromArtifactsUseCase` via desktop host composition and transport registration.  
4. **Use case invokes Python dataset prep port**, which creates/uses a runtime request id and forwards timeout metadata.  
5. **Runtime HTTP client sends `POST /tasks/execute`** to Python worker with an AbortController-backed timeout (`timeoutMs`).  
6. **Python worker executes task lifecycle** (`queued/running/...`) and for dataset prep applies **inactivity timeout** derived from metadata or timeout fallback.  
7. **Status/log polling path remains independent**: renderer can keep polling runtime status/log channels even if the original submit request fails/disconnects.  

### A2) Where abort can happen while background task continues

- **Renderer/UI request chain interruption** (e.g., fetch/IPC promise rejected) can happen while worker keeps running because worker task execution is server-side and independent after enqueue/start.  
- **Host HTTP client abort** (AbortController timeout or transport error) can terminate the caller await path while worker thread may still continue if server did not cancel task internally.  
- **Proxy/intermediary timeout** can sever HTTP response channel without terminating worker compute thread.  

---

## Section B: Timeout inventory table

| Layer | Timeout type | Configured value in repo | Library/framework default | Effective value (today) | Failure signature when hit | Can produce `fetch failed`? | How to measure/log precisely |
|---|---|---:|---|---|---|---|---|
| Renderer submit flow | Request timeout wrapper | **Unknown** (no explicit timeout found in dataset prep renderer hook/client path) | Browser/Electron `fetch` has no fixed request timeout by default (AbortSignal-driven) | Unknown | Rejected promise mapped into `"fetch failed"` messaging in renderer transport | Yes | Log submit start/end/error with requestId + elapsedMs at renderer and preload edges |
| Preload IPC bridge (`ipcRenderer.invoke`) | Invoke timeout wrapper | **None found** in preload call path for dataset prep | Electron IPC invoke has no documented built-in timeout | No explicit timeout in code | IPC rejection/error | Possibly (if mapped upstream) | Log invoke start/end/error and channel + requestId |
| Main→Python HTTP client (`/tasks/execute`) | **Abort timeout** | `timeoutMs` passed per request; default client fallback `120000` ms | Undici/Node fetch uses AbortSignal for request deadline; no app deadline unless provided | **Dataset prep path overrides to 43,200,000 ms (12h)** | Throws `Python runtime task request timed out after ...ms.` | Yes (if surfaces as generic fetch failure upstream) | Log computed `timeoutMs`, AbortSignal abort reason, elapsed, requestId |
| Dataset prep adapter | Task timeout propagation | Host composition sets `taskTimeoutMs = 12h` | N/A | 12h | Runtime returns timeout/cancel/fail contract errors | Indirectly | Log outbound runtime payload including timeoutMs + metadata |
| Dataset prep adapter | Inactivity timeout propagation | Host composition sets `inactivityTimeoutMs = 1,200,000 ms` (20m) | N/A | 20m | Worker-side inactivity timeout failure message/code | Not at ~5m unless overridden elsewhere | Log metadata `datasetPreparationInactivityTimeoutMs` and worker progress heartbeat deltas |
| Python worker task wait loop | Inactivity timeout | Uses metadata timeout; else falls back to request.timeoutMs | App-defined logic | 20m (from metadata) for dataset prep | Future timeout -> task failure payload | No direct `fetch failed`; becomes structured task error | Log `elapsed_ms_since_progress`, threshold, task_id |
| Python worker training/validation paths | Hard timeout | `request.timeoutMs` used in `future.result(timeout=...)` | Python concurrent futures timeout requires explicit value | Depends on request | Structured runtime timeout error | Indirect | Log timeout value and task type at entry |
| Runtime status/log polling channel | Poll interval/timeout | **Unknown in inspected files** for exact network timeout | Depends on transport impl | Unknown | Poll errors while background task alive | Could contribute to UX recovery flow | Add polling round-trip logs and timeout/error classification |
| Local reverse proxy/gateway/loopback middleware | Read/idle/proxy timeout | **Unknown in repo** (no explicit proxy config found in inspected path) | Common defaults often 60s/120s/300s depending component | Unknown | 502/504/reset/EOF around fixed wall-clock | Yes | Capture HTTP status codes, upstream timing headers, and socket close reason in host logs |
| OS/network/security middleware | Idle/session limits | Not configured in repo | Platform/security-product specific | Unknown | Connection reset/terminated near policy boundary (often 300s) | Yes | Repro with local loopback packet/error capture + security logs |

### Repo-backed timeout evidence (key values)

- Dataset prep task timeout is configured to **12 hours** in desktop host composition.  
- Dataset prep inactivity timeout is configured to **20 minutes** in desktop host composition.  
- Runtime HTTP client has a generic default task timeout of **120,000 ms**, but dataset prep path passes explicit timeout so this default is not effective there.  
- Runtime HTTP client enforces timeout using `AbortController` + `setTimeout(...abort...)`.  
- Worker inactivity timeout resolves from metadata `datasetPreparationInactivityTimeoutMs`, then falls back to `request.timeoutMs`.  

---

## Section C: Ranked culprits for timeout testing (9-minute and 7-minute targets)

1. **Intermediary/proxy idle/read timeout near 9 minutes (~540s)** — **Confidence: High**  
   - Matches the requested 9-minute timeout test target.  
   - App-configured dataset prep timeouts (12h/20m) are far larger, so a ~9m cutoff is more consistent with transport middle layer.

2. **Renderer/main fetch chain disconnect around 7 minutes (~420s), unrelated to runtime task timeout** — **Confidence: Medium-High**  
   - Fits the requested 7-minute timeout test target and symptom shape: submit path reports `fetch failed`, while runtime activity logs continue.  
   - Indicates caller-channel failure without worker termination.

3. **Host runtime HTTP client default timeout (120s)** — **Confidence: Low** for this dataset prep case  
   - Overridden by explicit 12h timeout for dataset prep requests.

4. **Worker inactivity timeout (20m)** — **Confidence: Low** for ~5m  
   - Configured value does not match 5m unless metadata/values differ at runtime.

5. **IPC invoke timeout wrapper in app code** — **Confidence: Low**  
   - No explicit wrapper found in inspected preload dataset-prep path.

---

## Section D: Instrumentation/verification steps (no behavior change, logging-only)

### D1) Correlation keys

- `requestId` (dataset request), `ipcChannel`, `runtimeTaskId` (same as requestId where possible), `attempt`, `ts` (ISO + monotonic), `elapsedMs`, `pid`, `thread/task`.

### D2) Exact logging points

1. **Renderer submit layer**
   - Log at submit start: requestId, payload size summary, timestamp.
   - Log at promise settle/error: elapsedMs, error name/message/cause.

2. **Preload IPC bridge**
   - Before `ipcRenderer.invoke`: channel, requestId, ts.
   - After resolve/reject: elapsedMs + structured error object.

3. **Main IPC handler**
   - Handler entry/exit with requestId.
   - If exception: stack + classification (`ipc_error`, `transport_error`, `runtime_error`).

4. **Runtime HTTP client (`/tasks/execute`)**
   - Log computed `timeoutMs`, whether from request override vs default.
   - Log abort timer armed/disarmed and abort reason.
   - Log response status, headers received time, body parse result.

5. **Python worker**
   - Task lifecycle events: queued/running/progress/final.
   - Inactivity watchdog checks: elapsed since last progress, threshold.
   - Final status with explicit reason code (`timeout`, `cancelled`, `failed`).

6. **Status/log polling channel**
   - Poll request/response roundtrip and errors with requestId correlation.
   - Distinguish poll-path errors from submit-path errors.

### D3) Proof patterns by culprit

- **a) Renderer fetch stack abort**: renderer/preload reject at T≈300s; main/worker continue with same requestId and eventually succeed/fail later.
- **b) Host/runtime HTTP client abort**: main logs AbortController-fired timeout at exact configured timeout value; worker may continue unless cancellation propagated.
- **c) Proxy/intermediary timeout**: HTTP status/transport reset near constant 300s across attempts; no AbortController timeout firing at that moment.
- **d) Worker timeout**: worker logs inactivity/hard-timeout threshold breach; client receives structured runtime error (not generic network fetch failure).

---

## Section E: Most likely root-cause hypothesis

**Hypothesis:** A **transport/intermediary timeout around 300 seconds** is severing the long-held submit HTTP response channel, while the Python worker keeps running and emitting logs/status independently.  
**Confidence:** **0.78 (High-leaning)** based on mismatch between observed ~5m cutoff and app-configured 12h/20m timeouts.

## Implementation note (Prompt 2, 2026-04-29)

- Python worker async lifecycle endpoints are now implemented (`/tasks/start`, `/tasks/{requestId}`, `/tasks/{requestId}/cancel`), but the dataset-preparation UI caller migration off `/tasks/execute` is still pending Prompt 3.

---

## Primary-source references to validate defaults (external)

- Electron `ipcRenderer.invoke` API behavior (no timeout wrapper by default): https://www.electronjs.org/docs/latest/api/ipc-renderer  
- Node.js `fetch` / Undici behavior and AbortSignal timeout pattern: https://nodejs.org/api/globals.html#fetch and https://undici.nodejs.org/#/docs/api/Dispatcher?id=parameter-requestoptions  
- Uvicorn/FastAPI server timeout options (for worker hosting context): https://www.uvicorn.org/settings/  
- NGINX proxy timeout directives (common 60/300s classes): https://nginx.org/en/docs/http/ngx_http_proxy_module.html  
