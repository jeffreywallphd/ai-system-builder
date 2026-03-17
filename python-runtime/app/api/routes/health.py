from fastapi import APIRouter, Depends
from app.api.dependencies import get_health_service
from app.models.responses import HealthResponse
from app.services.health_service import HealthService

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health(service: HealthService = Depends(get_health_service)) -> HealthResponse:
    return service.get_health()
