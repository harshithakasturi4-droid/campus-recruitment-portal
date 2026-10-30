import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["API_PORT"] ?? process.env["PORT"] ?? "8080";
const port = Number(rawPort);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid API_PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
