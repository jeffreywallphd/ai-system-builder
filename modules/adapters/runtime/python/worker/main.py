from os import getenv

import uvicorn

try:
    from .app import app
except ImportError:
    # Support direct script execution (`python main.py`) used by the desktop supervisor.
    from app import app


if __name__ == "__main__":
    uvicorn.run(
        app,
        host=getenv("PYTHON_RUNTIME_HOST", "127.0.0.1"),
        port=int(getenv("PYTHON_RUNTIME_PORT", "43111")),
        reload=False,
    )
