import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { WsAdapter } from "@nestjs/platform-ws";
import { AppModule } from "./app.module.js";
import { CONFIG } from "./common/config.js";
import { validateEnvironment } from "./common/env.js";
import { logEvent } from "./common/logger.js";

validateEnvironment();
const app = await NestFactory.create(AppModule, { logger: ["log", "warn", "error"] });
// Native ws, not socket.io — the browser connects with a plain WebSocket.
app.useWebSocketAdapter(new WsAdapter(app));
app.enableShutdownHooks();
await app.listen(CONFIG.port);
logEvent("info", "service_started", {
  port: CONFIG.port,
  websocketPath: "/session",
  maxSessions: CONFIG.maxSessions,
});
