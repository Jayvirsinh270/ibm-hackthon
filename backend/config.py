from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # IBM watsonx.ai credentials
    WATSONX_API_KEY: str = ""
    WATSONX_URL: str = "https://us-south.ml.cloud.ibm.com"
    WATSONX_PROJECT_ID: str = ""
    WATSONX_SPACE_ID: str = ""
    WATSONX_MODEL_ID: str = "ibm/granite-13b-chat-v2"

    # AI provider selection: "watsonx" or "mock"
    AI_PROVIDER: str = "mock"

    # File storage
    UPLOAD_DIR: str = "/tmp/xray"
    MAX_UPLOAD_SIZE_MB: int = 50
    REPO_TTL_SECONDS: int = 3600

    # Server
    BACKEND_PORT: int = 8000
    LOG_LEVEL: str = "INFO"


settings = Settings()
