
"""WHO 成人有氧運動 RAG 測試後端"""

import json
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header
import hmac
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

# ===== 1. 路徑與環境變數 =====

ROOT = Path(__file__).resolve().parent

# 明確讀取 backend 資料夾內的 .env
load_dotenv(dotenv_path=ROOT / ".env")

API_KEY = os.getenv("OPENAI_API_KEY")
MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

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

# 目前只供本機專題展示
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class AskBody(BaseModel):
    question: str

# ===== 4. 簡易文字檢索 =====

def grams(text):
    text = re.sub(r"\s+", "", text.lower())
    pairs = {
        text[i:i + 2]
        for i in range(len(text) - 1)
    }
    words = set(re.findall(r"[a-z]+|\d+", text))
    return pairs | words


def retrieve(question, k=4):
    query_grams = grams(question)
    results = []

    for record in knowledge:
        searchable = " ".join([
            str(record.get("主題", "")),
            str(record.get("測試問題", "")),
            str(record.get("內容", "")),
        ])

        score = len(
            query_grams & grams(searchable)
        ) / max(1, len(query_grams))

        results.append((score, record))

    results.sort(
        key=lambda item: item[0],
        reverse=True
    )

    return [
        record
        for score, record in results[:k]
        if score >= 0.08
    ]

# ===== 5. 健康檢查 =====

@app.get("/health")
def health():
    return {
        "status": "ok",
        "records": len(knowledge),
        "model": MODEL,
        "api_key_configured": bool(API_KEY),
    }

# ===== 6. RAG 問答 =====

@app.post("/ask")
def ask(
    body: AskBody,
    x_team_token: str = Header(default="")
):
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

    #接回下面原本的程式

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
    if not API_KEY:
        raise HTTPException(
            status_code=500,
            detail="找不到 OPENAI_API_KEY，請檢查 .env"
        )

    # D. 呼叫 OpenAI 模型
    try:
        client = OpenAI(api_key=API_KEY)

        response = client.responses.create(
            model=MODEL,
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
        print("錯誤類型：", type(exc).__name__, flush=True)
        print("HTTP 狀態碼：", getattr(exc, "status_code", None), flush=True)
        print("錯誤代碼：", getattr(exc, "code", None), flush=True)

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

