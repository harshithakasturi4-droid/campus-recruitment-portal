import { defineConfig } from "drizzle-kit";
import { existsSync } from "node:fs";
import path from "path";

const envFile = path.resolve(__dirname, "../../.env");
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path
    .resolve(__dirname, "./src/schema/**/*.ts")
    .replace(/\\/g, "/"),
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
