# Apply form → Telegram group

The marketing site (`index.html`) has one CTA: **Request access**. It opens an in-page form that collects enough context for any partner to pick up the request without follow-up. This document explains the moving parts and the **one-time setup**.

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

Until you finish setup, the form already works via the `mailto:` fallback — submissions open the user's mail client with a pre-filled letter addressed to `hello@croncore.com`.

## One-time setup

You do four small things by hand. Everything else (deploying the Worker, pushing secrets, rolling out updates) is handled by the `Deploy apply-form Worker` GitHub Action on every push to `main`.

### 1 · Create the notifier bot (already done)

We use `@croncore_applications_bot`. If you ever need to rotate the token: open [@BotFather](https://t.me/BotFather) → `/mybots` → pick the bot → **API Token → Revoke current token**.

### 2 · Add the bot to the partner group

Partner group invite (this is the one inquiries land in):
**https://t.me/+LKvrheCHrUdjZDBi**

1. Open the group and make sure you're an admin.
2. Add `@croncore_applications_bot` as a member (Group → Add member → search by username).
3. Promote it to admin with no extra permissions — Telegram is more reliable about delivering bot updates when the bot is admin.
4. Send any message in the group so the bot has at least one update to read.

### 3 · Get the numeric `chat_id`

Open in a browser:

```
https://api.telegram.org/bot<TOKEN>/getUpdates
```

(replace `<TOKEN>` with the token from BotFather). Look for `"chat":{"id":-1001234567890,…}`. **Save the negative number** — that's your `CHAT_ID`. Supergroups always start with `-100`.

If `getUpdates` returns an empty `result`, the bot hasn't seen anything yet — send another message in the group and refresh.

### 4 · Create a Cloudflare account + API token

1. Sign up / log in at https://dash.cloudflare.com (free).
2. Go to **My Profile → API Tokens → Create Token**.
3. Use the **Edit Cloudflare Workers** template.
4. Account Resources: your account. Zone Resources: All zones (or none — we don't need DNS).
5. Continue → Create. **Copy the token.**
6. Also copy your **Account ID** from any account-overview page (right sidebar).

### 5 · Add the secrets to GitHub

In this repo: **Settings → Secrets and variables → Actions → New repository secret**. Add:

| name                  | value                                                |
|-----------------------|------------------------------------------------------|
| `CLOUDFLARE_API_TOKEN`| the token from step 4                                |
| `CLOUDFLARE_ACCOUNT_ID`| account ID from step 4                              |
| `BOT_TOKEN`           | the token from BotFather                             |
| `CHAT_ID`             | the negative number from step 3                      |

### 6 · Trigger the workflow

Push any change to `apply-worker.js`, `wrangler.toml`, or `.github/workflows/deploy-worker.yml` to `main` — **or** run the workflow manually: **Actions → Deploy apply-form Worker → Run workflow**.

When it finishes, open the run log and grab the public Worker URL — it looks like `https://croncore-apply.<your-subdomain>.workers.dev`.

### 7 · Point the site at the Worker

In `index.html`, set the meta tag:

```html
<meta name="apply-endpoint" content="https://croncore-apply.<your-subdomain>.workers.dev" />
```

Commit, push, done. From now on, hitting **Send request** in the form will POST to the Worker, which forwards a Markdown card into the group.

## Verifying

- GET the Worker URL in a browser — it should respond `{"ok":true,"service":"croncore-apply"}`.
- Submit a test inquiry from the site. The group should receive a message within a couple of seconds.
- If something fails, the form shows a red error banner and logs the reason to the browser console; the Worker also logs to **Cloudflare → Workers → Logs**.

## Updating the Worker later

Edit `apply-worker.js`, commit, push to `main`. The GitHub Action redeploys automatically. Secrets are reapplied on every run, so rotating `BOT_TOKEN` is just "update the GitHub secret → re-run the workflow".

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
