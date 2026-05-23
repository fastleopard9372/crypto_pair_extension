from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = Field(
        "postgresql://USER:PASSWORD@HOST.neon.tech/neondb?sslmode=require",
        alias="DATABASE_URL",
    )
    mexc_base_url: str = Field("https://api.mexc.com", alias="MEXC_BASE_URL")
    coinmarketcap_base_url: str = Field(
        "https://pro-api.coinmarketcap.com",
        alias="COINMARKETCAP_BASE_URL",
    )
    coinmarketcap_api_key: str = Field("", alias="COINMARKETCAP_API_KEY")
    cors_origins: str = Field(
        "http://localhost:3000,http://127.0.0.1:3000",
        alias="CORS_ORIGINS",
    )
    cors_origin_regex: str = Field(
        r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$",
        alias="CORS_ORIGIN_REGEX",
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
