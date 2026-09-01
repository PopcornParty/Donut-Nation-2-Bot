# Donut Nation 2 Bot

Production Discord bot for the **Donut Nation 2** Minecraft / Donut SMP community.

Built with **Node.js** and **discord.js v14**. Persistent data lives in **SQLite** (easy to move to PostgreSQL later). Designed to run 24/7 on **Railway**.

## Features

- Automatic partnership tracker with configurable member / online requirements
- Full giveaway system with join button, auto-end, reroll, and claim button
- Game modes: Standard, Double or Keep, Rock Paper Scissors, Fast Click
- Scheduled daily giveaways that survive bot restarts
- Staff-maintained Donut SMP item price tracker with history
- Builder payments with 20% tax, statuses, and payment logs
- Builder balance / amount owed
- Build completion requests with customer Approve / Request Changes buttons
- Role-based permissions checked on the server, not just command names
- Slash commands, buttons, modals, embeds, select menus, and a minute-level scheduler

## Repository

https://github.com/PopcornParty/Donut-Nation-2-Bot

## 1. Create the Discord application

1. Open the Discord Developer Portal.
2. Click **New Application** and name it (example: `Donut Nation 2`).
3. Open the **Bot** tab and **Add Bot**.
4. Enable these **Privileged Gateway Intents**:
   - Server Members Intent
   - Presence Intent (needed for online member counts)
5. Reset / copy the **Bot Token**. This is `DISCORD_TOKEN`. Never commit it.
6. Open **General Information** and copy the **Application ID**. This is `CLIENT_ID`.

## 2. Invite the bot

Replace `YOUR_CLIENT_ID`:

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=268445776&scope=bot%20applications.commands
```

Enable **Developer Mode** in Discord. Right-click your server icon and **Copy Server ID**. That value is `GUILD_ID`.

## 3. Environment variables

See `.env.example`.

- `DISCORD_TOKEN` (required)
- `CLIENT_ID` (required)
- `GUILD_ID` (recommended for instant slash commands)
- `DATABASE_PATH` (default `./data/donut.db`; on Railway use `/data/donut.db`)
- `TZ` (example `America/New_York`)
- `LOG_LEVEL` (`info` by default)

## 4. Local run

```bash
git clone https://github.com/PopcornParty/Donut-Nation-2-Bot.git
cd Donut-Nation-2-Bot
cp .env.example .env
npm install
npm start
```

## 5. Deploy on Railway

1. Create a project at railway.app.
2. Deploy from the GitHub repo `PopcornParty/Donut-Nation-2-Bot`.
3. Add the environment variables above.
4. Add a volume mounted at `/data` and set `DATABASE_PATH=/data/donut.db`.
5. Railway runs `npm start`.
6. Invite the bot, then run `/config set`, `/partner setup`, and `/dailygiveaway setup`.

## Commands

- Everyone: `/help` `/price lookup` `/price list` `/price history`
- Customers: `/build approve` `/build changes` `/build view`
- Builders: `/builder balance` `/builder stats` `/build complete` `/build list`
- Staff: `/giveaway *` `/payment *` `/price add|update|remove`
- Admins: `/config` `/partner *` `/dailygiveaway *`

`/help` only lists commands the caller can use.

## Payments

Default tax is 20%. Example: customer pays $10,000, tax is $2,000, builder receives $8,000.

Statuses: pending, approved, paid, cancelled.

Amount owed = approved payments not yet marked paid.

## Price tracker

Staff update Order and AH prices through Discord modals. No unofficial live Donut SMP API is used.

## License

MIT
