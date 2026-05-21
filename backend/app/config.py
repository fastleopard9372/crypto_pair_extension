from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = Field(
        "postgresql://USER:PASSWORD@HOST.neon.tech/neondb?sslmode=require",
        alias="DATABASE_URL",
    )
    mexc_base_url: str = Field("https://api.mexc.com", alias="MEXC_BASE_URL")
    cors_origins: str = Field(
        "http://localhost:3000,http://127.0.0.1:3000",
        alias="CORS_ORIGINS",
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
