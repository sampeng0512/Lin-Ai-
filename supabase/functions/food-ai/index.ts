import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

const MAX_IMAGE_B64 = 6_000_000;
const MAX_TEXT = 400;
const MIME_OK = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

const SCHEMA = {
  type: "OBJECT",
  properties: {
    recognized: { type: "BOOLEAN" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          portion: { type: "STRING" },
          kcal: { type: "NUMBER" },
          protein_g: { type: "NUMBER" },
        },
        required: ["name", "portion", "kcal", "protein_g"],
      },
    },
    total_kcal: { type: "NUMBER" },
    note: { type: "STRING" },
  },
  required: ["recognized", "items", "total_kcal", "note"],
};

const BASE_RULES = [
  "你是台灣的營養估算助手，只回傳符合 schema 的 JSON。",
  "食物名稱與份量用繁體中文，使用台灣常見說法（例如：滷肉飯、雞腿便當、珍珠奶茶）。",
  "kcal 與 protein_g 是單一品項依該份量的合理估計值，取整數；total_kcal 是所有品項 kcal 的總和。",
  "份量看不清楚時，以台灣一般外食的常見份量估計，並在 portion 寫出你假設的份量。",
  "note 用一句繁體中文簡短說明估計依據或不確定之處，不要給減重或節食建議。",
].join("\n");

const IMAGE_RULES = [
  "任務：辨識照片中準備要吃的食物與飲料，逐項列出。",
  "忽略餐具、桌子、包裝上的文字以外的非食物物品。",
  "如果照片裡沒有食物或完全無法判斷，recognized 設為 false，items 為空陣列，total_kcal 為 0，note 說明原因。",
].join("\n");

const TEXT_RULES = [
  "任務：使用者用文字描述這一餐吃了什麼，請拆成品項逐項估計。",
  "如果描述與食物無關或無法理解，recognized 設為 false，items 為空陣列，total_kcal 為 0，note 說明原因。",
].join("\n");

function clean(raw: any) {
  const items = Array.isArray(raw?.items) ? raw.items : [];
  const out = items
    .slice(0, 15)
    .map((it: any) => ({
      name: String(it?.name ?? "").trim().slice(0, 40),
      portion: String(it?.portion ?? "").trim().slice(0, 40),
      kcal: Math.max(0, Math.min(3000, Math.round(Number(it?.kcal) || 0))),
      protein_g: Math.max(0, Math.min(300, Math.round(Number(it?.protein_g) || 0))),
    }))
    .filter((it: any) => it.name);
  return {
    recognized: Boolean(raw?.recognized) && out.length > 0,
    items: out,
    total_kcal: out.reduce((s: number, it: any) => s + it.kcal, 0),
    note: String(raw?.note ?? "").trim().slice(0, 200),
  };
}

async function callGemini(apiKey: string, parts: unknown[]) {
  const models = [Deno.env.get("GEMINI_MODEL"), "gemini-3.5-flash", "gemini-flash-latest"].filter(Boolean) as string[];
  let lastErr = "";
  for (const model of [...new Set(models)]) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.2 },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 404 || res.status === 400 && /model/i.test(JSON.stringify(data?.error ?? ""))) {
        lastErr = `model ${model} unavailable`;
        continue;
      }
      if (!res.ok) throw new Error(`gemini ${res.status}: ${data?.error?.message ?? "unknown"}`);
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
      return { model, result: clean(JSON.parse(text || "{}")) };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(lastErr || "no model available");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed", message: "只接受 POST" });

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json(500, { error: "not_configured", message: "伺服器尚未設定 AI 金鑰" });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json(401, { error: "login_required", message: "請先登入帳號才能使用 AI 辨識" });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad_request", message: "資料格式錯誤" });
  }

  const mode = body?.mode;
  const hint = String(body?.text ?? "").trim().slice(0, MAX_TEXT);
  let parts: unknown[];
  if (mode === "image") {
    const b64 = String(body?.image ?? "").replace(/^data:[^;]+;base64,/, "");
    const mime = String(body?.mime ?? "image/jpeg").toLowerCase();
    if (!b64) return json(400, { error: "bad_request", message: "沒有收到照片" });
    if (b64.length > MAX_IMAGE_B64) return json(413, { error: "too_large", message: "照片太大，請重新拍一張" });
    if (!MIME_OK.has(mime)) return json(400, { error: "bad_mime", message: "不支援這種圖片格式" });
    parts = [
      { text: `${BASE_RULES}\n${IMAGE_RULES}${hint ? `\n使用者補充說明：${hint}` : ""}` },
      { inline_data: { mime_type: mime, data: b64 } },
    ];
  } else if (mode === "text") {
    if (!hint) return json(400, { error: "bad_request", message: "請輸入這餐吃了什麼" });
    parts = [{ text: `${BASE_RULES}\n${TEXT_RULES}\n使用者描述：${hint}` }];
  } else {
    return json(400, { error: "bad_request", message: "mode 必須是 image 或 text" });
  }

  const limit = Math.max(1, Number(Deno.env.get("FOOD_AI_DAILY_LIMIT") ?? 20) || 20);
  const { data: used, error: rpcErr } = await admin.rpc("lin_food_ai_take", { p_user: userData.user.id, p_limit: limit });
  if (rpcErr) return json(500, { error: "quota_error", message: "暫時無法使用，請稍後再試" });
  if (used === -1) return json(429, { error: "daily_limit", message: `今天的 AI 辨識次數已用完（每天 ${limit} 次），可以改用手動輸入`, limit });

  try {
    const { model, result } = await callGemini(apiKey, parts);
    return json(200, { ...result, mode, model, used, limit });
  } catch (e) {
    console.error("food-ai", e instanceof Error ? e.message : String(e));
    return json(502, { error: "ai_failed", message: "AI 辨識失敗，請再試一次或改用手動輸入" });
  }
});
