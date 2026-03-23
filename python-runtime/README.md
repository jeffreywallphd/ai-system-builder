# AI Loom Studio Python Runtime

FastAPI service that executes Python-native and LangChain-backed workflow nodes.

## Local setup

The preferred local-development path is now:

1. Install a supported Python interpreter on your machine. AI Loom Studio currently supports **Python 3.11** and **Python 3.12** for the built-in runtime.
2. Start the app and open **Settings** if you want to change the built-in Python version selection.
3. Open **Managed Services** and use the built-in Python runtime card to **Provision**, **Repair**, or **Recreate env** as needed.
4. Start the managed runtime from the app.

Manual `python -m venv` and `pip install -r requirements.txt` steps are now an advanced fallback rather than the primary path.

## Advanced manual fallback

If you need to troubleshoot outside the supervisor, you can still provision the environment manually:

```bash
cd python-runtime
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8100 --reload
```

## Local MCP authoring

- The runtime can provision workspace-local MCP tools for AI Loom Studio.
- Those workspace-local tools execute directly from their saved provisioning state inside the runtime, so provisioning no longer performs an automatic `pip install` step.
- If you want to run a generated `server.py` file as a standalone MCP stdio process outside the runtime, install the MCP Python package in that environment first.

## Endpoints

- `GET /health`
- `POST /execute/node`
- `POST /execute/workflow`
- `POST /training/jobs`
- `GET /training/jobs`
- `GET /training/jobs/{job_id}`
- `POST /training/jobs/{job_id}/cancel`
- `POST /datasets/generate`
- `GET /workflows/capabilities`

## Training + dataset generation truthfulness

- `python-runtime-local` runs a real in-process NumPy gradient-training job for a lightweight text-adapter backend. It is a truthful local training path, not a remote provider fine-tuning API.
- `python-runtime-manifest` writes manifest/export-only artifacts and stops at a `prepared` state.
- Dataset generation prefers a true provider/model-backed OpenAI-compatible API path when `AI_LOOM_OPENAI_API_KEY` is configured. When that is unavailable, the runtime records a `runtime-local-deterministic` fallback instead of overstating the result as provider-backed.
