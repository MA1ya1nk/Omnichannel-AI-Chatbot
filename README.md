# Omnichannel AI Chatbot - Phase 1

Phase 1 delivers the unified AI brain for web chat:
- Express + TypeScript backend
- Mistral service layer + message normalization layer
- Next.js 14 dark-themed web chat widget
- PostgreSQL persistence through Prisma

## Project Structure

- `apps/backend`: API, normalization, Mistral service, Prisma
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

## Notes

- This is a monorepo using npm workspaces. A root `node_modules` is expected and standard.
- Never place real secrets in any `*.example` file.