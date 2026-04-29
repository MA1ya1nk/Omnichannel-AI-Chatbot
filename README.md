# Omnichannel AI Chatbot - Phase 1 and 2

Phase 1 and 2 deliver the unified AI brain for web + messaging channels:
- Express + TypeScript backend
- Mistral service layer + message normalization layer
- Next.js 14 dark-themed web chat widget
- PostgreSQL persistence through Prisma
- Telegram webhook integration
- Slack Bolt event webhook integration
- Channel response renderer (Telegram Inline Keyboard + Slack Block Kit)

## Project Structure

- `apps/backend`: API, normalization, Mistral service, Prisma, Telegram/Slack webhooks
- `apps/frontend`: Dashboard + web chat widget

## Setup

1. Create app-specific env files:
   - Copy `apps/backend/.env.example` -> `apps/backend/.env`
   - Copy `apps/frontend/.env.example` -> `apps/frontend/.env.local`
2. Install dependencies:
   - `npm install`
3. Generate Prisma client:
   - `npm run prisma:generate --workspace backend`
4. Run migrations:
   - `npm run prisma:migrate --workspace backend`
5. Start backend + frontend:
   - `npm run dev`

Frontend: `http://localhost:3000`  
Backend health: `http://localhost:4000/health`

## Webhooks

- Telegram webhook endpoint: `POST /webhooks/telegram`
- Slack webhook endpoint (Bolt): `POST /webhooks/slack`

## ngrok Local Testing

1. Start backend:
   - `npm run dev:backend`
2. Start ngrok tunnel on backend port:
   - `ngrok http 4000`
3. Copy your HTTPS forwarding URL from ngrok:
   - Example: `https://abcd1234.ngrok-free.app`

### Telegram setup

1. Set `TELEGRAM_BOT_TOKEN` in `apps/backend/.env`.
2. Register webhook:
   - `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<NGROK_URL>/webhooks/telegram`
3. Send a message to your bot in Telegram.

### Slack setup

1. Set `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET` in `apps/backend/.env`.
2. In Slack app settings:
   - Event Subscriptions -> Enable Events
   - Request URL: `<NGROK_URL>/webhooks/slack`
3. Subscribe to bot events:
   - `message.channels`
   - `message.im`
4. Reinstall app to workspace, then send a message where bot is present.

## Notes

- This is a monorepo using npm workspaces. A root `node_modules` is expected and standard.
- Never place real secrets in any `*.example` file.