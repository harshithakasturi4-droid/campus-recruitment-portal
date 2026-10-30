// Vercel Serverless Function entrypoint
// Imports the pre-built Express app (no listen() call) and re-exports it
// as the default handler for Vercel.
export { default } from "../artifacts/api-server/dist/app.mjs";
