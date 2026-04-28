import cors from "cors";
import express from "express";
import chatRouter from "./routes/chat.js";
import { env } from "./env.js";

const app = express();
const port = env.BACKEND_PORT;

app.use(
  cors({
    origin: [env.FRONTEND_ORIGIN]
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/chat", chatRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof Error) {
    return res.status(400).json({ error: error.message });
  }
  return res.status(500).json({ error: "Unknown server error" });
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
