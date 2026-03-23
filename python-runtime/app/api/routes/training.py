from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_model_training_service
from app.models.requests import FineTuningJobRequest
from app.models.responses import FineTuningJobResponse
from app.services.model_training_service import ModelTrainingService

router = APIRouter(prefix="/training", tags=["training"])


@router.post("/jobs", response_model=FineTuningJobResponse)
def create_training_job(
    request: FineTuningJobRequest,
    service: ModelTrainingService = Depends(get_model_training_service),
) -> FineTuningJobResponse:
    try:
        return service.submit_job(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/jobs", response_model=list[FineTuningJobResponse])
def list_training_jobs(
    service: ModelTrainingService = Depends(get_model_training_service),
) -> list[FineTuningJobResponse]:
    return service.list_jobs()


@router.get("/jobs/{job_id}", response_model=FineTuningJobResponse)
def get_training_job(
    job_id: str,
    service: ModelTrainingService = Depends(get_model_training_service),
) -> FineTuningJobResponse:
    try:
        return service.get_job(job_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=f"Training job '{job_id}' was not found.") from error


@router.post("/jobs/{job_id}/cancel", response_model=FineTuningJobResponse)
def cancel_training_job(
    job_id: str,
    service: ModelTrainingService = Depends(get_model_training_service),
) -> FineTuningJobResponse:
    try:
        return service.cancel_job(job_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=f"Training job '{job_id}' was not found.") from error
