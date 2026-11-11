
"""WHO 成人有氧運動 RAG 測試後端"""

import hmac
import json
import logging
import os
import re
import threading
import time
from collections import defaultdict, deque
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("fitai-rag")

# ===== 1. 路徑與環境變數 =====

ROOT = Path(__file__).resolve().parent

# 明確讀取 backend 資料夾內的 .env
load_dotenv(dotenv_path=ROOT / ".env")

API_KEY = os.getenv("OPENAI_API_KEY")
MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
CORS_ALLOW_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv("CORS_ALLOW_ORIGINS", "").split(",")
    if origin.strip()
]
# 每個 IP 每分鐘最多可發問幾次，避免 OpenAI 額度被刷爆
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "10"))
MAX_QUESTION_CHARS = 500
MAX_OUTPUT_TOKENS = 800

# client 只建立一次，重複使用連線
client = OpenAI(api_key=API_KEY, timeout=30, max_retries=1) if API_KEY else None

# ===== 2. 載入 WHO 知識庫 =====

DB = ROOT / "who_adult_aerobic_rag.json"

if not DB.exists():
    raise FileNotFoundError(
        f"找不到 WHO 知識庫：{DB}"
    )

with DB.open("r", encoding="utf-8-sig") as f:
    knowledge = json.load(f)

if not isinstance(knowledge, list):
    raise ValueError("JSON 知識庫必須是資料列表")

# ===== 3. 建立 FastAPI =====

app = FastAPI(title="WHO 成人有氧 RAG 後端")

# Allow local development and Netlify deployments; configure custom production
# domains through the comma-separated CORS_ALLOW_ORIGINS environment variable.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_origin_regex=(
        r"^https?://(?:localhost|127\.0\.0\.1)(?::\d+)?$"
        r"|^https://(?:[a-z0-9-]+\.)*netlify\.app$"
    ),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class AskBody(BaseModel):
    question: str = Field(min_length=1, max_length=MAX_QUESTION_CHARS)

# ===== 4. 簡易文字檢索 =====


def grams(text):
    text = re.sub(r"\s+", "", text.lower())
    pairs = {
        text[i:i + 2]
        for i in range(len(text) - 1)
    }
    words = set(re.findall(r"[a-z]+|\d+", text))
    return pairs | words


# 知識庫不會在執行中改變，啟動時先算好每筆資料的 grams
INDEX = [
    (
        grams(" ".join([
            str(record.get("主題", "")),
            str(record.get("測試問題", "")),
            str(record.get("內容", "")),
        ])),
        record,
    )
    for record in knowledge
]


def retrieve(question, k=4):
    query_grams = grams(question)
    results = [
        (len(query_grams & record_grams) / max(1, len(query_grams)), record)
        for record_grams, record in INDEX
    ]

    results.sort(
        key=lambda item: item[0],
        reverse=True
    )

    return [
        record
        for score, record in results[:k]
        if score >= 0.08
    ]

# ===== 5. 簡易限流 =====


_hits = defaultdict(deque)
_hits_lock = threading.Lock()


def client_ip(request: Request):
    # Render 的代理會把真正的來源 IP 加在 X-Forwarded-For 的最後面；
    # 前面的值可以由使用者自己亂填，拿來限流會被繞過
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def check_rate_limit(ip):
    now = time.monotonic()
    with _hits_lock:
        q = _hits[ip]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= RATE_LIMIT_PER_MINUTE:
            raise HTTPException(
                status_code=429,
                detail="發問太頻繁，請稍等一分鐘再試"
            )
        q.append(now)
        # 清掉已經沒有紀錄的 IP，避免字典無限長大
        if len(_hits) > 1000:
            for key in [key for key, value in _hits.items() if not value]:
                del _hits[key]

# ===== 6. 健康檢查 =====


@app.get("/health")
def health():
    return {
        "status": "ok",
        "records": len(knowledge),
        "model": MODEL,
        "api_key_configured": bool(API_KEY),
        "team_token_configured": bool(os.getenv("TEAM_ACCESS_TOKEN", "")),
    }

# ===== 7. RAG 問答 =====


@app.post("/ask")
def ask(
    body: AskBody,
    request: Request,
    x_team_token: str = Header(default="")
):
    # 先限流再檢查密碼，避免組員密碼被無限次猜
    check_rate_limit(client_ip(request))

    expected_token = os.getenv("TEAM_ACCESS_TOKEN", "")

    if not expected_token:
        raise HTTPException(
            status_code=503,
            detail="後端尚未設定組員存取密碼"
        )

    if not hmac.compare_digest(
        x_team_token.encode("utf-8"),
        expected_token.encode("utf-8")
    ):
        raise HTTPException(
            status_code=401,
            detail="組員存取密碼錯誤"
        )

    question = body.question.strip()

    if not question:
        raise HTTPException(
            status_code=400,
            detail="請輸入問題"
        )

    # A. 搜尋 WHO 知識庫
    hits = retrieve(question)

    if not hits:
        return {
            "answer": "目前知識庫沒有足夠資料回答。",
            "sources": []
        }

    # B. 將搜尋到的資料整理成上下文
    context = "\n\n".join(
        (
            f"[{r.get('知識編號', '')}] "
            f"{r.get('標題', '')}\n"
            f"{r.get('內容', '')}\n"
            f"資料性質：{r.get('資料性質', '')}\n"
            f"來源：{r.get('來源網址', '')}"
        )
        for r in hits
    )

    # C. 檢查 API Key
    if client is None:
        raise HTTPException(
            status_code=500,
            detail="找不到 OPENAI_API_KEY，請檢查 .env"
        )

    # D. 呼叫 OpenAI 模型
    try:
        response = client.responses.create(
            model=MODEL,
            max_output_tokens=MAX_OUTPUT_TOKENS,
            instructions=(
                "你是健身 App 的運動資訊助理。"
                "只依據提供的 WHO 知識片段回答。"
                "請使用繁體中文。"
                "如果資料不足，應明確說明。"
                "不要編造沒有出現在資料中的事實。"
                "保留數字、單位與適用條件。"
                "區分 WHO 官方建議與計算範例。"
                "回答最後附上引用的知識編號。"
            ),
            input=(
                f"WHO 知識片段：\n{context}\n\n"
                f"使用者問題：{question}"
            )
        )

    except Exception as exc:
        # 不將可能包含敏感資訊的原始錯誤回傳給前端
        log.error(
            "模型呼叫失敗：type=%s status=%s code=%s",
            type(exc).__name__,
            getattr(exc, "status_code", None),
            getattr(exc, "code", None),
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "模型呼叫失敗，請檢查 API Key、"
                "額度、模型權限或網路連線"
            )
        ) from exc

    # E. 將 AI 回答與來源回傳給前端
    return {
        "answer": response.output_text,
        "sources": [
            {
                "id": r.get("知識編號", ""),
                "title": r.get("標題", ""),
                "url": r.get("來源網址", "")
            }
            for r in hits
        ]
    }
