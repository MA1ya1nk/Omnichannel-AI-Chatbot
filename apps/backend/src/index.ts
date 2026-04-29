import cors from "cors";
import express from "express";
import chatRouter from "./routes/chat.js";
import webhooksRouter from "./routes/webhooks.js";
import { env } from "./env.js";
import { slackReceiver } from "./services/slack-bolt.js";

const app = express();
const port = env.BACKEND_PORT;

app.use(
  cors({
    origin: [env.FRONTEND_ORIGIN]
  })
);

app.use("/webhooks/slack", slackReceiver.router);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/chat", chatRouter);
app.use("/webhooks", webhooksRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof Error) {
    return res.status(400).json({ error: error.message });
  }
  return res.status(500).json({ error: "Unknown server error" });
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
