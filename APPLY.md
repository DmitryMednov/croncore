# Apply form → Telegram group

The marketing site (`index.html`) has one CTA: **Request access**. It opens an in-page form that collects enough context for any partner to pick up the request without follow-up. This document explains the moving parts and how to wire the form to your Telegram group.

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

Until you finish setup, the form already works via the `mailto:` fallback — submissions open the user's mail client with a pre-filled letter addressed to `hello@croncore.com`. Change the recipient in `index.html`:

```html
<meta name="apply-mailto" content="hello@croncore.com" />
```

## One-time setup (≈ 15 minutes)

### 1 · Create a "notifier" bot

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. `/newbot` → give it any name (e.g. `Croncore Inquiries`) and a username ending in `_bot`.
3. **Copy the token** — looks like `123456789:AAExxxxxxxxxxxxxxxxxxx`.

This bot is purely a notifier — it doesn't need to be the same as your eventual `@CRONCORE_bot` advisor.

### 2 · Add the bot to your partner group

1. Open the Telegram group with your partners.
2. Add the new bot as a member (Group → Add member → search by username).
3. Send any message in the group so the bot can see at least one update.
4. Get the group's `chat_id` by opening in a browser:

   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```

   Look for `"chat":{"id":-1001234567890,...}`. **Save the negative number** — that's your `CHAT_ID`. (Supergroups start with `-100`.)

### 3 · Deploy the Worker

Easiest path — Cloudflare dashboard:

1. Sign up / log in at https://dash.cloudflare.com (free).
2. **Workers & Pages** → **Create application** → **Create Worker** → give it a name like `croncore-apply`.
3. Click **Quick edit**, replace the default content with everything from `apply-worker.js` (in this repo), and **Save and deploy**.
4. In **Settings → Variables**, add:
   - **Encrypted (Secret)** — `BOT_TOKEN` = your token from step 1
   - **Plaintext (Variable)** — `CHAT_ID` = the negative number from step 2
   - **Plaintext (Variable)** — `ALLOW_ORIGIN` = `https://croncore.io` (or `*` for any origin while testing)
5. Note the public Worker URL — e.g. `https://croncore-apply.your-name.workers.dev`.

CLI alternative (if you have wrangler installed):

```bash
wrangler init croncore-apply --type none
cp apply-worker.js croncore-apply/src/index.js
cd croncore-apply
wrangler secret put BOT_TOKEN          # paste the token
wrangler deploy --var CHAT_ID:-100123456 --var ALLOW_ORIGIN:https://croncore.io
```

### 4 · Point the site at the Worker

In `index.html`, set the meta tag:

```html
<meta name="apply-endpoint" content="https://croncore-apply.your-name.workers.dev" />
```

That's it. Reload the site. From now on, hitting **Send request** in the form will POST to the Worker, which forwards a Markdown card into the group.

## Verifying

- GET the Worker URL in a browser — it should respond `{"ok":true,"service":"croncore-apply"}`.
- Submit a test inquiry from the site. The group should receive a message within a couple of seconds.
- If something fails, the form shows a red error banner and logs the reason to the browser console; the Worker also logs to **Cloudflare → Workers → Logs**.

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

## Going back to the multi-section site

The previous landing is preserved verbatim as `index.full.html` next to this file. To switch back:

```bash
cp index.full.html index.html
```

…and either keep both, or delete `index.full.html` once you don't need the reference.
