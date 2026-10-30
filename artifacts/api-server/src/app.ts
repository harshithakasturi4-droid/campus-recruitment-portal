import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:5173";
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === allowedOrigin) return callback(null, true);
      try {
        const parsed = new URL(origin);
        if (
          parsed.hostname.endsWith(".vercel.app") ||
          parsed.hostname === "localhost" ||
          parsed.hostname === "127.0.0.1"
        ) {
          return callback(null, true);
        }
      } catch {}
      callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api", router);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  logger.error({ err: error }, "Request failed");
  if (!response.headersSent) {
    response.status(500).json({ error: "An unexpected server error occurred." });
  }
});

export default app;
