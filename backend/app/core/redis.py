import httpx
import json
from app.core.config import settings

HEADERS = {
    "Authorization": f"Bearer {settings.UPSTASH_REDIS_TOKEN}",
    "Content-Type": "application/json",
}

async def redis_set(key: str, value: str, ex: int = None):
    cmd = ["SET", key, value]
    if ex:
        cmd += ["EX", str(ex)]
    async with httpx.AsyncClient() as client:
        await client.post(settings.UPSTASH_REDIS_URL, json=cmd, headers=HEADERS)

async def redis_get(key: str) -> str | None:
    async with httpx.AsyncClient() as client:
        res = await client.post(
            settings.UPSTASH_REDIS_URL,
            json=["GET", key],
            headers=HEADERS
        )
        data = res.json()
        return data.get("result")

async def redis_delete(key: str):
    async with httpx.AsyncClient() as client:
        await client.post(settings.UPSTASH_REDIS_URL, json=["DEL", key], headers=HEADERS)

async def redis_set_json(key: str, value: dict, ex: int = None):
    await redis_set(key, json.dumps(value), ex)

async def redis_get_json(key: str) -> dict | None:
    raw = await redis_get(key)
    if raw:
        return json.loads(raw)
    return None

async def redis_incr(key: str) -> int:
    async with httpx.AsyncClient() as client:
        res = await client.post(settings.UPSTASH_REDIS_URL, json=["INCR", key], headers=HEADERS)
        return res.json().get("result", 0)

async def redis_zadd(key: str, score: float, member: str):
    async with httpx.AsyncClient() as client:
        await client.post(
            settings.UPSTASH_REDIS_URL,
            json=["ZADD", key, str(score), member],
            headers=HEADERS
        )

async def redis_zrevrange(key: str, start: int = 0, stop: int = 49) -> list:
    async with httpx.AsyncClient() as client:
        res = await client.post(
            settings.UPSTASH_REDIS_URL,
            json=["ZREVRANGE", key, str(start), str(stop), "WITHSCORES"],
            headers=HEADERS
        )
        return res.json().get("result", [])
