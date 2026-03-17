from fastapi import FastAPI
from app.api.routes.health import router as health_router
from app.api.routes.execute import router as execute_router
from app.api.routes.workflows import router as workflows_router
from app.core.logging import configure_logging

configure_logging()

app = FastAPI(title="AI Loom Python Runtime", version="0.1.0")
app.include_router(health_router)
app.include_router(execute_router)
app.include_router(workflows_router)
