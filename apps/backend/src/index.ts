import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import adminRouter from "./routes/admin.js";
import chatRouter from "./routes/chat.js";
import usersRouter from "./routes/users.js";
import webhooksRouter from "./routes/webhooks.js";
import { env } from "./env.js";
import { slackReceiver } from "./services/slack-bolt.js";
import { initSocketServer } from "./services/socket-server.js";

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
app.use("/api/admin", adminRouter);
app.use("/api/users", usersRouter);
app.use("/webhooks", webhooksRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof Error) {
    return res.status(400).json({ error: error.message });
  }
  return res.status(500).json({ error: "Unknown server error" });
});

const server = createServer(app);
initSocketServer(server);

server.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
