from app.core.config import settings
from app.models.responses import HealthResponse


class HealthService:
    def get_health(self) -> HealthResponse:
        return HealthResponse(
            status="ok",
            version=settings.runtime_version,
            details={"name": settings.runtime_name, "environment": settings.environment},
        )
