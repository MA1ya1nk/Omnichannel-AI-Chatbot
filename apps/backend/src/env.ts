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
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000"
};
