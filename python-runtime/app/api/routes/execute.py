from fastapi import APIRouter, Depends
from app.api.dependencies import get_runtime_service
from app.models.requests import ExecuteNodeRequest, ExecuteWorkflowRequest
from app.models.responses import ExecuteNodeResponse, ExecuteWorkflowResponse
from app.services.runtime_service import RuntimeService

router = APIRouter(prefix="/execute", tags=["execute"])


@router.post("/node", response_model=ExecuteNodeResponse)
def execute_node(request: ExecuteNodeRequest, service: RuntimeService = Depends(get_runtime_service)) -> ExecuteNodeResponse:
    return service.execute_node(request)


@router.post("/workflow", response_model=ExecuteWorkflowResponse)
def execute_workflow(
    request: ExecuteWorkflowRequest, service: RuntimeService = Depends(get_runtime_service)
) -> ExecuteWorkflowResponse:
    return service.execute_workflow(request)
