from collections.abc import AsyncGenerator

from dotenv import load_dotenv
from prisma import Prisma


load_dotenv()

db = Prisma()


async def connect_db() -> None:
    if not db.is_connected():
        await db.connect()


async def disconnect_db() -> None:
    if db.is_connected():
        await db.disconnect()


async def get_db() -> AsyncGenerator[Prisma, None]:
    yield db
