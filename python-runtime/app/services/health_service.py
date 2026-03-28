from app.core.config import settings
from app.models.responses import HealthResponse, RuntimeCapabilityStatus
from app.services.model_training_service import ModelTrainingService


class HealthService:
    def __init__(self, training_service: ModelTrainingService | None = None) -> None:
        self._training_service = training_service or ModelTrainingService()

    def get_health(self) -> HealthResponse:
        training_capability = self._training_service.inspect_local_training_capability()
        capability_status = RuntimeCapabilityStatus(
            capability_id=training_capability.capability_id,
            state=training_capability.state,
            reason_code=training_capability.reason_code,
            reason_category=training_capability.reason_category,
            detail=training_capability.detail,
            checked_at=training_capability.checked_at,
            metadata=training_capability.metadata,
        )
        return HealthResponse(
            status="ok",
            version=settings.runtime_version,
            details={
                "name": settings.runtime_name,
                "environment": settings.environment,
                "runtimeBoot": {"state": "healthy", "detail": "Python runtime API is serving requests."},
                "capabilities": {
                    capability_status.capability_id: capability_status.model_dump(mode="json"),
                },
                "taskReadiness": {
                    "local-gradient-training": {
                        "state": "ready" if capability_status.state == "ready" else "unavailable",
                        "reasonCode": capability_status.reason_code,
                        "reasonCategory": capability_status.reason_category,
                    },
                },
            },
        )
