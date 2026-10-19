# Portal Tiers — live Discord sync

This updates the existing dark/purple website and removes all fictional leaderboard entries. The website shows only records stored from parsed Discord test-result messages. It uses server-sent events for near-instant updates, with a one-minute recovery refresh.

## What the integration does
- Watches one configured Discord results channel.
- Parses embeds/messages containing IGN, GAMEMODE, REGION, NEW-TIER, and optional TESTER fields.
- On startup, scans up to `SYNC_HISTORY_LIMIT` recent messages to import existing results; newer results overwrite older results for the same Minecraft username + gamemode.
- Stores one current entry per Minecraft username + gamemode in Supabase. Retesting that entry updates its tier and recalculates points.
- Sorts by points descending; ties break by username ascending, then gamemode ascending.
- Includes an admin-only `/tier-remove` command when `DISCORD_ADMIN_ROLE_ID` is configured (Discord server Administrators are also allowed).
- Keeps bot token and Supabase service-role key on the server only.

Tier points: HT1 40, LT1 35, HT2 30, LT2 25, HT3 20, LT3 15, HT4 10, LT4 5, HT5 3, LT5 2.

## 1. Create the Supabase database
1. Create a project at https://supabase.com/.
2. Open **SQL Editor** and run all of `schema.sql`.
3. In Project Settings → API, copy the Project URL and `service_role` secret key. Keep the service-role key private; never add it to `public/` or GitHub client-side files.

## 2. Create/configure the Discord bot
1. Open https://discord.com/developers/applications and create an application, then add a Bot.
2. Copy the bot token once and store it as `DISCORD_BOT_TOKEN` in your hosting environment.
3. Under **Bot → Privileged Gateway Intents**, enable **Message Content Intent**. The bot needs View Channel, Read Message History, and View Channels access to the results channel. It does not need Administrator permissions.
4. Invite it to your server using OAuth2 URL Generator with `bot` and `applications.commands` scopes, and the permissions above.
5. Copy your server ID and the results channel ID (enable Developer Mode in Discord, then right-click/long-press the server/channel → Copy ID).
6. In the results channel, ensure test result messages contain readable structured labels, preferably `IGN`, `GAMEMODE`, `REGION`, `NEW-TIER`, and `TESTER`. The parser accepts a label and value on the same line or the value on the next line, including embeds.
7. If your testing bot posts a tier only as an image, or posts no readable `NEW-TIER`/tier fields, this bot cannot reliably infer it. Configure the testing bot to include the tier in embed text/fields, or add a structured webhook/API integration. Do not rely on OCR or role colour alone.

## 3. Deploy the website + bot together
This is a Node backend now, so **GitHub Pages alone cannot run the bot**. Use a Node web host such as Render for the service and Supabase for persistent data.
1. Upload the contents of this folder to a GitHub repository (root should contain `server.js`, `package.json`, `schema.sql`, and `public/`). Do not upload `.env` or real tokens.
2. On Render, create a **Web Service** from that repository. Build command: `npm install`; start command: `npm start`; Node version 20 or newer.
3. Add these environment variables in Render's Environment panel:
   - `DISCORD_BOT_TOKEN` — bot token
   - `DISCORD_GUILD_ID` — Discord server ID
   - `DISCORD_RESULTS_CHANNEL_ID` — channel ID where tier result messages are posted
   - `DISCORD_ADMIN_ROLE_ID` — optional role ID allowed to use `/tier-remove`
   - `SUPABASE_URL` — Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — private service-role secret
   - `SYNC_HISTORY_LIMIT` — optional; default 500, maximum 1000
4. Deploy and open `https://YOUR-SERVICE.onrender.com/api/health`. `ok` should be true and `missing` should be empty. The free host may sleep when idle; bot synchronization is paused while the service is asleep, and historical sync catches up after it wakes. Use an always-on host for uninterrupted live tracking.
5. Open the service root URL to view Portal Tiers. It is served from the same backend, so `/api/players` and `/api/events` use the same origin.

## 4. Test it
1. Deploy the bot and check logs for `Discord bot ready` and `Historical sync complete`.
2. Post a new test result in the configured channel using the same readable embed/message format as the screenshot.
3. Within a moment, the site should update its player tier and points and re-sort the table.
4. Retesting the same username + gamemode updates that entry rather than creating a duplicate.
5. To remove an entry, use `/tier-remove username:<IGN> gamemode:<Crystal|Sword|Axe|Pot>` as a server Administrator or member of the configured admin role.

## Important behavior / boundaries
- No fictional/sample player names are included. If no historical Discord messages parse, the leaderboard stays empty until a valid test result is received.
- The database stores one current tier entry per Minecraft username and gamemode. If a player has multiple modes, they appear once per mode; the gamemode filter ranks only the selected mode, while All modes sorts all current entries.
- The Discord screenshot is a visual reference, not a live API connection. Actual syncing begins only after you configure the bot token, server/channel IDs, Supabase project, and hosting environment.
- This version imports readable historical messages at startup and listens for new messages. Deleting a Discord message does not automatically remove its ranking because message deletion is not necessarily a request to remove the player; use `/tier-remove` for explicit removal.
