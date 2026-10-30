import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const frontendRoot = path.resolve(import.meta.dirname);
const workspaceRoot = path.resolve(frontendRoot, '..');

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, workspaceRoot, '');
  const rawPort = env.FRONTEND_PORT || '5173';
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid FRONTEND_PORT value: "${rawPort}"`);
  }

  const allowedHosts = (env.DEV_ALLOWED_HOSTS || 'localhost,127.0.0.1,::1')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);

  return {
    envDir: workspaceRoot,
    base: env.BASE_PATH || '/',
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
        env.VITE_API_BASE_URL ?? 'http://localhost:8080',
      ),
    },
    plugins: [
      react(),
      tailwindcss(),
      runtimeErrorOverlay(),
      ...(mode !== 'production' && process.env.REPL_ID !== undefined
        ? [
            await import('@replit/vite-plugin-cartographer').then((m) =>
              m.cartographer({
                root: workspaceRoot,
              }),
            ),
            await import('@replit/vite-plugin-dev-banner').then((m) =>
              m.devBanner(),
            ),
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(frontendRoot, 'src'),
        '@assets': path.resolve(workspaceRoot, 'attached_assets'),
      },
      dedupe: ['react', 'react-dom'],
    },
    root: frontendRoot,
    build: {
      outDir: path.resolve(frontendRoot, 'dist/public'),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: env.HOST || '127.0.0.1',
      allowedHosts,
      fs: {
        strict: true,
      },
    },
    preview: {
      port,
      host: env.HOST || '127.0.0.1',
      allowedHosts,
    },
  };
});
