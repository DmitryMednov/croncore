/**
 * CRONCORE — apply form → Telegram group bridge.
 *
 * Cloudflare Worker (free tier is plenty). Receives the application form
 * from the marketing site, validates and rate-limits, then posts a tidy
 * Markdown message into a Telegram group via the Bot API.
 *
 * Deploy:
 *   1. Create a bot via @BotFather, copy the token.
 *   2. Add the bot to the target Telegram group, send any message so the
 *      bot can discover the chat. Get the chat_id (negative for groups)
 *      via   https://api.telegram.org/bot<TOKEN>/getUpdates
 *   3. wrangler init / wrangler deploy (or paste this file into the
 *      Cloudflare dashboard's "Quick edit" for a new Worker).
 *   4. Set bindings:
 *        Secret  BOT_TOKEN  = 123456:ABC-...
 *        Var     CHAT_ID    = -1001234567890
 *        Var     ALLOW_ORIGIN = https://croncore.io   (or "*" for any)
 *   5. Put the public Worker URL into index.html:
 *        <meta name="apply-endpoint" content="https://your-worker.workers.dev" />
 *
 * Endpoints:
 *   GET  /        → "ok" (health check)
 *   POST /submit  → { ok: true } on success, { ok: false, error } on failure
 *   *  OPTIONS    → CORS preflight
 */

export default {
  async fetch(req, env, ctx) {
    const allow = (env.ALLOW_ORIGIN || "*").trim();
    const cors = {
      "Access-Control-Allow-Origin": allow,
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
      "Vary": "Origin",
    };

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(req.url);

    if (req.method === "GET") {
      return json({ ok: true, service: "croncore-apply" }, 200, cors);
    }

    if (req.method !== "POST" || url.pathname.replace(/\/+$/, "") !== "/submit") {
      return json({ ok: false, error: "not_found" }, 404, cors);
    }

    if (!env.BOT_TOKEN || !env.CHAT_ID) {
      return json({ ok: false, error: "not_configured" }, 503, cors);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "bad_json" }, 400, cors);
    }

    // Honeypot — drop silently with success so spam bots think it worked.
    if (body.website) return json({ ok: true }, 200, cors);

    const e = validate(body);
    if (e) return json({ ok: false, error: e }, 400, cors);

    const text = buildMessage(body, req);

    const tg = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.CHAT_ID,
        text,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
    });

    if (!tg.ok) {
      const errText = await tg.text().catch(() => "");
      console.error("telegram api error", tg.status, errText);
      return json({ ok: false, error: "telegram_failed" }, 502, cors);
    }

    return json({ ok: true }, 200, cors);
  },
};

/* -------- helpers -------- */

function json(payload, status, cors) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
  });
}

function validate(b) {
  if (typeof b !== "object" || !b) return "bad_body";
  const need = ["name", "telegram", "direction", "message"];
  for (const k of need) if (!str(b[k])) return `missing_${k}`;

  if (str(b.name).length > 120) return "name_too_long";
  if (str(b.telegram).length > 40) return "telegram_too_long";
  if (str(b.email).length > 120) return "email_too_long";
  if (str(b.message).length > 1500) return "message_too_long";
  if (str(b.message).length < 10) return "message_too_short";

  if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(b.email))) return "email_invalid";

  const dirs = new Set(["payments","invest","spv","legal","concierge","network","other"]);
  if (!dirs.has(str(b.direction))) return "direction_invalid";
  return null;
}

function str(v) { return v == null ? "" : String(v).trim(); }

function esc(v) {
  // Telegram MarkdownV2 reserves _ * [ ] ( ) ~ ` > # + - = | { } . !
  return str(v).replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

function buildMessage(b, req) {
  const cf = req.cf || {};
  const meta = [];
  if (b.lang) meta.push(`lang ${esc(b.lang)}`);
  if (cf.country) meta.push(`ip ${esc(cf.country)}`);
  if (cf.city) meta.push(esc(cf.city));

  const lines = [];
  lines.push("📨 *New CRONCORE inquiry*");
  lines.push("");
  lines.push(`*Name:* ${esc(b.name)}`);
  lines.push(`*Telegram:* ${esc(b.telegram)}`);
  if (b.email) lines.push(`*Email:* ${esc(b.email)}`);
  lines.push("");
  lines.push(`*Direction:* ${esc(prettyDirection(b.direction))}`);
  if (b.jurisdiction) lines.push(`*Jurisdiction:* ${esc(b.jurisdiction)}`);
  if (b.budget) lines.push(`*Budget:* ${esc(b.budget)}`);
  if (b.timeline) lines.push(`*Timeline:* ${esc(b.timeline)}`);
  lines.push("");
  lines.push("*Brief:*");
  lines.push(esc(b.message));
  if (meta.length) {
    lines.push("");
    lines.push("_" + esc("· " + meta.join(" · ")) + "_");
  }
  return lines.join("\n");
}

function prettyDirection(d) {
  return ({
    payments: "Payments & Fintech",
    invest: "Investments & DeFi",
    spv: "SPV & Tokenization",
    legal: "Legal & Corporate",
    concierge: "Concierge & Real Estate",
    network: "Private Network",
    other: "Something else",
  })[d] || d;
}
