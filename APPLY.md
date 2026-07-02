# Apply form → Telegram group

The marketing site (`index.html`) has one CTA: **Request access**. It opens an in-page form that collects enough context for any partner to pick up the request without follow-up. This document explains the moving parts and how to wire the form to your Telegram group.

## Current wiring

| piece            | value                                              |
|------------------|----------------------------------------------------|
| Notifier bot     | `@croncore_applications_bot`                       |
| Partner group    | https://t.me/+LKvrheCHrUdjZDBi                     |
| Bot token        | **kept out of the repo** — lives in the Worker as a secret |
| Worker URL       | *(pending — fill in `<meta name="apply-endpoint">` when deployed)* |
| Group `chat_id`  | *(pending — see step 1 below)*                     |

## How it works

```
visitor → form (modal in index.html)
              │
              ├─ if  meta[apply-endpoint]  is set  →  POST JSON to the Cloudflare Worker
              │                                       Worker validates + sends to the bot,
              │                                       bot posts MarkdownV2 message into the group
              │
              └─ otherwise (no endpoint)            →  mailto: fallback opens default mail client
                                                       with the same content pre-filled
```

Until you finish deployment, the form already works via the `mailto:` fallback — submissions open the user's mail client with a pre-filled letter addressed to `hello@croncore.com`. Change the recipient in `index.html`:

```html
<meta name="apply-mailto" content="hello@croncore.com" />
```

## Deploy checklist — three human steps

### Step 1 · Get the group's `chat_id`

1. Open [https://t.me/+LKvrheCHrUdjZDBi](https://t.me/+LKvrheCHrUdjZDBi) in Telegram (as an admin).
2. Group menu → **Add member** → search `@croncore_applications_bot` → add.
3. Post any message in the group (e.g. `test`) so the bot has one update to read.
4. Run this from any terminal (Telegram API isn't reachable from my sandbox, so this one is on you):

   ```bash
   curl -sS 'https://api.telegram.org/bot8908574050:AAGbHcUgAU3h5mM1T3D0bSgFz3vySPj5GsM/getUpdates' \
     | python3 -m json.tool
   ```

   In the JSON, find `"chat":{"id":-100…,…}`. **Copy that negative number** — that's your `CHAT_ID`.

   Empty `result`? Send another message in the group and re-run. If it stays empty, this bot may already have a webhook set — clear it once with:

   ```bash
   curl -sS 'https://api.telegram.org/bot8908574050:AAGbHcUgAU3h5mM1T3D0bSgFz3vySPj5GsM/deleteWebhook'
   ```

### Step 2 · Deploy the Worker

Easiest path — Cloudflare dashboard, no CLI needed:

1. Log in at https://dash.cloudflare.com (free plan is enough).
2. **Workers & Pages → Create → Create Worker** → name it `croncore-apply` → **Deploy**.
3. Click **Edit code**, delete everything, paste the whole content of [`apply-worker.js`](./apply-worker.js) from this repo, **Save & deploy**.
4. **Settings → Variables & Secrets** → add:
   - Type **Secret** — name `BOT_TOKEN` — value `8908574050:AAGbHcUgAU3h5mM1T3D0bSgFz3vySPj5GsM`
   - Type **Text** — name `CHAT_ID` — value the negative number from step 1
   - Type **Text** — name `ALLOW_ORIGIN` — value `https://croncore.io` (or `*` while you test)
5. Copy the public URL Cloudflare shows for the Worker — looks like `https://croncore-apply.<your-name>.workers.dev`.

CLI alternative (if wrangler is your speed):

```bash
# in the repo root
npx wrangler deploy apply-worker.js --name croncore-apply
npx wrangler secret put BOT_TOKEN --name croncore-apply       # paste the token
npx wrangler deploy --var CHAT_ID:-100xxxxxxxxxx --var ALLOW_ORIGIN:https://croncore.io
```

`wrangler.toml` is intentionally not committed so nothing pins your account/zone by accident — the CLI works fine without it, and the dashboard path doesn't need it at all.

### Step 3 · Point the site at the Worker

Send me the Worker URL and I'll drop it into `<meta name="apply-endpoint">` in `index.html` and push, or do it yourself:

```html
<meta name="apply-endpoint" content="https://croncore-apply.<your-name>.workers.dev" />
```

That's it. Reload the site — from now on, hitting **Send request** in the form POSTs to the Worker, which forwards a Markdown card into the group.

## Verifying end-to-end

- Open the Worker URL in a browser — should reply `{"ok":true,"service":"croncore-apply"}`.
- Submit a test inquiry from the site. The partner group should receive a message within a couple of seconds.
- If something fails, the form shows a red error banner and logs the reason to the browser console; the Worker also logs to **Cloudflare → Workers → Logs** (real-time tail is under the Worker's **Logs** tab).

## Fields collected

Every inquiry includes:

| field          | required | notes                                                            |
|----------------|:--------:|------------------------------------------------------------------|
| `name`         | yes      | Free-text, max 120 chars.                                        |
| `telegram`     | yes      | Normalised to `@username` on submit; max 40 chars.               |
| `email`        | no       | Optional backup channel; validated against a simple regex.       |
| `direction`    | yes      | One of: payments, invest, spv, legal, concierge, network, other. |
| `jurisdiction` | no       | UAE, EU, UK, US, CIS, APAC, LATAM, other.                        |
| `budget`       | no       | `<100k`, `100-500k`, `500k-2m`, `2-10m`, `10m+`, `n/a`.          |
| `timeline`     | no       | `asap`, `weeks`, `months`, `quarter`, `explore`.                 |
| `message`      | yes      | 10–1500 chars. The brief itself.                                 |
| `lang`         | auto     | Current site language (en/de/ru/ar/he/es).                       |

The Worker rejects malformed payloads and silently swallows honeypot-tripping submissions.

## Rotating the token

If the token ever leaks, in `@BotFather` → `/mybots` → `croncore_applications_bot` → **API Token** → **Revoke current token**. Paste the new one into the Worker's `BOT_TOKEN` secret and you're done — no code change needed.

## Going back to the multi-section site

The previous landing is preserved verbatim as `index.full.html` next to this file. To switch back:

```bash
cp index.full.html index.html
```

…and either keep both, or delete `index.full.html` once you don't need the reference.
