from fastapi import APIRouter, Depends

from app.api.dependencies import get_model_training_service
from app.models.requests import FineTuningJobRequest
from app.models.responses import FineTuningJobResponse
from app.services.model_training_service import ModelTrainingService

router = APIRouter(prefix="/training", tags=["training"])


@router.post("/fine-tune", response_model=FineTuningJobResponse)
def fine_tune_model(
    request: FineTuningJobRequest,
    service: ModelTrainingService = Depends(get_model_training_service),
) -> FineTuningJobResponse:
    return service.submit_job(request)
