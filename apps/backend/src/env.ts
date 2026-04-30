import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env")
});

export const env = {
  BACKEND_PORT: Number(process.env.BACKEND_PORT ?? 4000),
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  MISTRAL_API_KEY: process.env.MISTRAL_API_KEY ?? "",
  MISTRAL_MODEL: process.env.MISTRAL_MODEL ?? "mistral-small-latest",
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? "",
  TELEGRAM_WEBHOOK_SECRET_TOKEN: process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN ?? "",
  SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN ?? "",
  SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET ?? "",
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN ?? "",
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
  WEBHOOK_IDEMPOTENCY_TTL_MS: Number(process.env.WEBHOOK_IDEMPOTENCY_TTL_MS ?? 300000),
  ADMIN_API_TOKEN: process.env.ADMIN_API_TOKEN ?? "dev-admin-token",
  ADMIN_RATE_LIMIT_PER_MINUTE: Number(process.env.ADMIN_RATE_LIMIT_PER_MINUTE ?? 120)
};
