import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/**
 * The super-admin console.
 *
 * A separate app from `apps/mobile` on purpose. The console is dense tables,
 * money and bulk actions on a wide screen; the app is a phone. Sharing a bundle
 * would mean either react-native-web rendering data grids badly, or shipping
 * every invoice screen to twenty thousand phones that will never open one.
 *
 * What the two *do* share is `@m-ensemble/shared` — as **types only** here. That
 * package is CommonJS TypeScript source (see `apps/server/src/shared.ts` for the
 * long version of why), and a type import is erased at compile time, so nothing
 * of it reaches the browser bundle. Anything this app needs at runtime it
 * defines for itself.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Same-origin in the browser, so the console needs no CORS entry and no
    // absolute API base — `fetch('/api/...')` works in dev and behind any
    // reverse proxy in production without a build-time switch.
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
});
