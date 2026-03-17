from functools import lru_cache
from app.execution.node_dispatcher import NodeDispatcher
from app.execution.workflow_executor import WorkflowExecutor
from app.services.health_service import HealthService
from app.services.runtime_service import RuntimeService


@lru_cache
def get_health_service() -> HealthService:
    return HealthService()


@lru_cache
def get_runtime_service() -> RuntimeService:
    dispatcher = NodeDispatcher()
    workflow_executor = WorkflowExecutor(dispatcher)
    return RuntimeService(dispatcher=dispatcher, workflow_executor=workflow_executor)
