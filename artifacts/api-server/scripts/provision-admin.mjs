import { createRequire } from "node:module";
import { createInterface } from "node:readline";
import bcrypt from "bcryptjs";
import { z } from "zod";

const requireFromDatabasePackage = createRequire(
  new URL("../../../lib/db/package.json", import.meta.url),
);
const { Client } = requireFromDatabasePackage("pg");
const emailSchema = z.string().email().max(254);
const passwordSchema = z.string().min(10).refine(
  (value) => Buffer.byteLength(value, "utf8") <= 72,
  "Password must not exceed 72 UTF-8 bytes.",
);

function readHidden(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("Run this command directly in an interactive terminal.");
  }

  return new Promise((resolveInput, rejectInput) => {
    let value = "";
    process.stdout.write(prompt);
    process.stdin.setEncoding("utf8");
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const finish = (error) => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdout.write("\n");
      if (error) rejectInput(error);
      else resolveInput(value);
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          finish(new Error("Provisioning cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u0008" || character === "\u007f") {
          value = value.slice(0, -1);
        } else {
          value += character;
        }
      }
    };

    process.stdin.on("data", onData);
  });
}

function confirmImmediatelyBeforeInsert() {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  return prompt.question(
    "This will create one Admin account in the configured Neon database. Type CREATE to proceed: ",
  ).finally(() => prompt.close());
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Provisioning stopped: DATABASE_URL is not configured.");
  process.exitCode = 1;
} else {
  let hostname;
  try {
    hostname = new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    console.error("Provisioning stopped: database target could not be verified.");
    process.exitCode = 1;
  }

  if (hostname && hostname !== "neon.tech" && !hostname.endsWith(".neon.tech")) {
    console.error("Provisioning stopped: configured database is not verified as Neon.");
    process.exitCode = 1;
  } else if (hostname) {
    const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10000 });
    try {
      await client.connect();
      const identity = await client.query("SELECT current_database() AS database_name");
      if (identity.rows[0]?.database_name !== "neondb") {
        throw new Error("Configured database identity is not the expected PlaceMate database.");
      }

      await client.query("BEGIN READ ONLY");
      const initialCount = await client.query(
        "SELECT count(*)::int AS admin_count FROM users WHERE role = $1",
        ["admin"],
      );
      await client.query("COMMIT");
      if (initialCount.rows[0].admin_count > 0) {
        console.log("Provisioning stopped: an Admin account already exists.");
      } else {
        const emailInput = await readHidden("Admin email (input hidden): ");
        let passwordInput = await readHidden("Admin password (input hidden): ");
        const email = emailInput.trim().normalize("NFC").toLowerCase();
        const checkedEmail = emailSchema.safeParse(email);
        const checkedPassword = passwordSchema.safeParse(passwordInput);
        if (!checkedEmail.success || !checkedPassword.success) {
          throw new Error("Email or password does not meet the required format.");
        }

        const passwordHash = await bcrypt.hash(passwordInput, 12);
        passwordInput = "";
        await client.query("BEGIN");
        try {
          await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["placemate-first-admin"]);
          const currentCount = await client.query(
            "SELECT count(*)::int AS admin_count FROM users WHERE role = $1",
            ["admin"],
          );
          if (currentCount.rows[0].admin_count > 0) {
            await client.query("ROLLBACK");
            console.log("Provisioning stopped: an Admin account already exists.");
          } else {
            const duplicateEmail = await client.query(
              "SELECT 1 FROM users WHERE email = $1 LIMIT 1",
              [email],
            );
            if (duplicateEmail.rowCount > 0) {
              await client.query("ROLLBACK");
              throw new Error("That email already belongs to an account; no changes were made.");
            }

            const confirmation = await confirmImmediatelyBeforeInsert();
            if (confirmation !== "CREATE") {
              await client.query("ROLLBACK");
              console.log("Provisioning cancelled; no changes were made.");
            } else {
              await client.query(
                "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)",
                [email, passwordHash, "admin"],
              );
              await client.query("COMMIT");
              console.log("First Admin account created successfully.");
            }
          }
        } catch (error) {
          try {
            await client.query("ROLLBACK");
          } catch {}
          throw error;
        }
      }
    } catch {
      console.error("Provisioning failed or was cancelled; sensitive values were not displayed.");
      process.exitCode = 1;
    } finally {
      await client.end().catch(() => {});
    }
  }
}
