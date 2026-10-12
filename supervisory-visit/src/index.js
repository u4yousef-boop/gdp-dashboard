const recentCalls = new Map();
const WINDOW_MS = 60_000;
const MAX_CALLS_PER_WINDOW = 20;
const MAX_PROMPT_CHARS = 30_000;
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/ai") return env.ASSETS.fetch(request);

    const origin = request.headers.get("Origin");
    const allowedOrigin = env.ALLOWED_ORIGIN || url.origin;
    if (origin && origin !== url.origin && origin !== allowedOrigin) {
      return json({ error: "الطلب غير مسموح." }, 403);
    }

    const corsHeaders = origin
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Vary": "Origin",
        }
      : {};
    const reply = (data, status = 200) => json(data, status, corsHeaders);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== "POST") return reply({ error: "استخدم POST." }, 405);

    const now = Date.now();
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const calls = (recentCalls.get(ip) || []).filter((time) => now - time < WINDOW_MS);
    if (calls.length >= MAX_CALLS_PER_WINDOW) {
      return reply({ error: "تجاوزت عدد الطلبات المسموح مؤقتًا. حاول بعد دقيقة." }, 429);
    }
    calls.push(now);
    recentCalls.set(ip, calls);

    let body;
    try {
      body = await request.json();
    } catch {
      return reply({ error: "تعذر قراءة الطلب." }, 400);
    }
    if (typeof body.prompt !== "string" || !body.prompt.trim()) return reply({ error: "الطلب فارغ." }, 400);
    if (body.prompt.length > MAX_PROMPT_CHARS) return reply({ error: "النص أطول من الحد المسموح." }, 413);

    try {
      const result = await env.AI.run(MODEL, {
        messages: [{ role: "user", content: body.prompt }],
        max_tokens: 3000,
        temperature: 0.35,
      });
      const text = result?.response ?? result?.choices?.[0]?.message?.content;
      if (typeof text !== "string" || !text.trim()) throw new Error("Empty model response");
      return reply({ text });
    } catch {
      return reply({ error: "تعذر توليد النص. تحقق من تفعيل Workers AI في حساب Cloudflare ثم أعد المحاولة." }, 502);
    }
  },
};
