# Feedback bot — setup runbook

One-time setup to bring the Telegram testers-group feedback bot online.
Design: `docs/superpowers/specs/2026-07-10-telegram-feedback-bot-design.md`.
Code: `feedback-bot/`, `scripts/fetch-feedback-backlog.py`, `scripts/deploy-feedback-bot.py`.

## 1. Create the bot in @BotFather

1. `/newbot` → name it (e.g. "Mirocard Feedback"), get the token.
2. `/setprivacy` → select the new bot → **Disable** (it must see all group
   messages, not just commands, to cache them for later reactions).
3. Add the bot to the Mirocard2 testers group, then **promote it to
   administrator** (no specific permissions need to be granted — the
   `administrator` status itself is what matters). This is required: Telegram
   only sends bots the `message_reaction` update (which includes *who*
   reacted) if the bot is an admin of that chat. A regular member bot only
   sees anonymous aggregate counts (`message_reaction_count`), which our code
   doesn't handle and which can't be filtered to the owner's reaction.
4. If the group was a "basic group" (not already a supergroup), promoting a
   bot to admin auto-upgrades it to a supergroup — **this changes the chat's
   internal id**. Re-fetch the chat id (step 2 below) *after* this promotion,
   not before, and update `FEEDBACK_BOT_CHAT_ID` if it changed.
5. Check the group's reaction settings (Group Settings → Reactions). If it's
   set to a restricted "Some reactions" list, 👀 may not be selectable — an
   admin needs to switch it to "All Reactions", or the trigger emoji in
   `feedback-bot/formatting.py` (`PIN_EMOJI`) needs to be changed to one that
   is in the allowed set.

## 2. Collect the IDs you need

- **Owner Telegram user id**: message `@userinfobot` from your own account.
- **Group chat id**: add `@RawDataBot` to the group temporarily (or check
  `getUpdates` after sending a message) — it's a negative number like
  `-1001234567890` for a supergroup.

## 3. Configure `.env` on the runtime host

On `192.168.1.163`, create `C:/Users/dmazn/Projects/Mirocard2/feedback-bot/.env`
(this file is never uploaded by the deploy script — create/edit it directly on
the host over SSH or RDP) with real values, following `feedback-bot/.env.example`:

```text
FEEDBACK_BOT_TOKEN=<token from step 1>
FEEDBACK_BOT_OWNER_ID=<your user id from step 2>
FEEDBACK_BOT_CHAT_ID=<group chat id from step 2>
FEEDBACK_BOT_CACHE_RETENTION_DAYS=30
FEEDBACK_BOT_DATA_DIR=C:/Users/dmazn/Projects/Mirocard2/feedback
```

## 4. First deploy

From the local machine, with `MIROCARD_DEPLOY_PASSWORD` (or
`MIROCARD_DEPLOY_KEY_PATH`) set in the environment:

```bash
python scripts/deploy-feedback-bot.py
```

This uploads `feedback-bot/*.py` and `requirements.txt` to
`C:/Users/dmazn/Projects/Mirocard2/feedback-bot/` on the runtime host and
tries to restart the `MirocardFeedbackBot` task (harmless no-op the first
time, since the task doesn't exist yet).

Then, on the runtime host itself, install dependencies once:

```powershell
cd C:\Users\dmazn\Projects\Mirocard2\feedback-bot
pip install -r requirements.txt
```

## 5. Register the scheduled task

On the runtime host itself (not over a plain SSH exec — Scheduled Task
registration needs an interactive session per the existing `MirocardBackend2`
precedent documented in `DEPLOYMENT.md`):

```powershell
cd C:\Users\dmazn\Projects\Mirocard2
.\scripts\install-feedback-bot-task.ps1
Start-ScheduledTask -TaskName "MirocardFeedbackBot"
```

## 6. Manual test checklist (from the design doc)

1. Send a plain text message in the testers group, then a message with a
   photo attached. React 👀 on both (as the owner).
   Expect: 👍 appears on both within a few seconds; two new lines appear in
   `C:/Users/dmazn/Projects/Mirocard2/feedback/inbox.jsonl` on the runtime
   host, and the screenshot lands in `feedback/screenshots/`.
2. Restart the bot task (`Stop-ScheduledTask` then
   `Start-ScheduledTask -TaskName "MirocardFeedbackBot"`), then react 👀 on a
   message that was sent *before* the restart.
   Expect: 👍 still appears (the persistent cache survived the restart).
3. React 👀 as a **different** Telegram account (not the owner).
   Expect: no reaction from the bot, no new backlog entry.
4. From the local dev machine:
   ```bash
   python scripts/fetch-feedback-backlog.py
   ```
   Expect: new entries appear in the local `feedback/inbox.jsonl`; running it
   again immediately prints `0 new entries` and doesn't duplicate lines.
5. Manually edit one local entry's `status` to `"done"`, then run
   `scripts/fetch-feedback-backlog.py` again.
   Expect: that entry's `status` is still `"done"` after the sync.

## 7. Video ingestion setup (optional)

Same bot process, extended to also watch a **separate** Telegram group and
archive every video posted there into a shared Google Photos album. Code:
`feedback-bot/video_ingest.py`, `feedback-bot/google_photos.py`,
`feedback-bot/authorize_google_photos.py`.

### 7.1 Telegram side — video group + local Bot API server

1. Create a new Telegram group (separate from the testers group) for raw
   video, add the same `Mirocard Feedback` bot to it. Admin rights aren't
   required for this part (only reactions need it, per step 1 above).
2. Get its chat id the same way as step 2 above (`@RawDataBot`, or
   `getUpdates`) — a negative number.
3. The standard Bot API caps `getFile` downloads at **20 MB**, far too small
   for phone-shot video. Fix: run a local Bot API server
   (`telegram-bot-api`, Telegram's own open-source component) alongside the
   bot; it raises the limit to 2 GB.
   - Register an app at <https://my.telegram.org/apps> (login with your own
     phone number) to get an `api_id` and `api_hash` — one-time, needed only
     to run this server, not to log in as a user.
   - Get `telegram-bot-api.exe` for Windows (build from
     <https://github.com/tdlib/telegram-bot-api> per its README, or use a
     prebuilt community release) and place it at
     `C:\Users\dmazn\Projects\Mirocard2\telegram-bot-api\telegram-bot-api.exe`.
   - On the runtime host: `.\scripts\install-telegram-local-api-task.ps1
     -ApiId <id> -ApiHash <hash>`, then
     `Start-ScheduledTask -TaskName "TelegramLocalBotApi"`.
4. In `.env`, set `TELEGRAM_LOCAL_API_URL=http://127.0.0.1:8081` and
   `FEEDBACK_BOT_VIDEO_CHAT_ID=<chat id from step 2>`.

### 7.2 Google Photos side — OAuth + shared album

1. In Google Cloud Console: create/select a project, enable **Photos
   Library API**, configure the OAuth consent screen (External, Testing
   mode is fine — add your own Google account as a test user), then create
   an **OAuth client ID** of type **Desktop app**. Download its JSON.
2. Save it as `feedback/google_client_secret.json` on the runtime host (this
   directory is already gitignored — never commit it) and set
   `GOOGLE_PHOTOS_CLIENT_SECRET_PATH` / `GOOGLE_PHOTOS_TOKEN_PATH` /
   `GOOGLE_PHOTOS_ALBUM_TITLE` in `.env` per `.env.example`.
3. Run `python authorize_google_photos.py` once, interactively, **with a
   browser available** — it opens a consent screen. The headless runtime
   host usually has no interactive browser session; if so, run this step on
   your own dev machine instead (same `client_secret_path`, a temporary
   `token_path`), then copy the resulting `google_photos_token.json` to the
   host's `GOOGLE_PHOTOS_TOKEN_PATH`. The bot only needs the saved token
   afterwards — no browser involved once it exists, since Google refreshes
   access tokens from the stored refresh token automatically.
4. This same run also creates the shared album (title from
   `GOOGLE_PHOTOS_ALBUM_TITLE`) and prints its id and a shareable link.
   Copy the id into `.env` as `GOOGLE_PHOTOS_ALBUM_ID`, then send the link
   to your team — each person taps **Join** in their own Google Photos app
   to see the album. Storage for everything uploaded counts against *your*
   Google account's quota, not theirs, regardless of who's in the group.
5. `pip install -r requirements.txt` again on the host (picks up
   `requests`, `google-auth`, `google-auth-oauthlib`), then restart
   `MirocardFeedbackBot`.

### 7.3 Test

Send a video over 20 MB in the video group. Expect a ✅ reaction within a
couple of minutes and the clip to show up in the shared album (Google needs
some time to finish processing a freshly uploaded video). A ❌ reaction
means it failed — check `feedback/bot.log` on the host.
