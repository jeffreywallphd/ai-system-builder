from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    runtime_name: str = "ai-loom-python-runtime"
    runtime_version: str = "0.1.0"
    environment: str = "development"

    model_config = SettingsConfigDict(env_file=".env", env_prefix="PY_RUNTIME_")


settings = Settings()
