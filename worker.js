/**
 * El Beauty AI — Cloudflare Worker proxy for Anthropic API.
 *
 * Зачем нужен: прототип El Beauty ходит за AI-ответами и анализом фото на
 * Anthropic Messages API. Ключ Anthropic нельзя класть в клиентский JS
 * (index_elbeauty.html) — его увидит любой в исходном коде страницы.
 * Этот воркер стоит между фронтом и Anthropic: держит ключ в секретах
 * Cloudflare, принимает запрос от прототипа и сам подставляет ключ.
 *
 * ===================== КАК РАЗВЕРНУТЬ (через дашборд, без консоли) =====================
 * 1. cloudflare.com → залогинься → Workers & Pages → Create → Create Worker
 * 2. Дай имя, например "el-beauty-ai" → Deploy (создаст болванку)
 * 3. Edit code → удали всё, что там есть → вставь целиком этот файл → Save and Deploy
 * 4. Слева Settings → Variables and Secrets → Add
 *      - Name: ANTHROPIC_API_KEY
 *      - Value: твой ключ с console.anthropic.com (начинается на sk-ant-...)
 *      - Type: Secret (encrypted) → Deploy
 * 5. Скопируй адрес воркера сверху (вида
 *    https://el-beauty-ai.<твой-сабдомен>.workers.dev)
 * 6. В index_elbeauty.html найди константу AI_ENDPOINT (в начале функции
 *    callClaude) и вставь туда этот адрес вместо api.anthropic.com/v1/messages
 * 7. Пересохрани файл, залей на GitHub — AI должен заработать
 *
 * Проверка: открой воркер-урл в браузере — должен вернуть 405 Method Not
 * Allowed (это нормально, воркер принимает только POST). Если видишь 500
 * или ошибку про ключ — проверь, что секрет ANTHROPIC_API_KEY сохранён.
 * =========================================================================
 */

const ALLOWED_ORIGIN = "*"; // при желании сузь до своего домена github.io

export default {
  async fetch(request, env) {
    // Preflight CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed — this endpoint only accepts POST", {
        status: 405,
        headers: { "Access-Control-Allow-Origin": ALLOWED_ORIGIN },
      });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY is not set in Worker secrets" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          },
        }
      );
    }

    try {
      const incomingBody = await request.text();

      const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: incomingBody,
      });

      const responseBody = await anthropicResponse.text();

      return new Response(responseBody, {
        status: anthropicResponse.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err && err.message || err) }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        },
      });
    }
  },
};
