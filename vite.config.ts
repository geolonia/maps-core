import { defineConfig } from 'vite';

export default defineConfig({
  root: 'example',
  server: {
    port: 5174,
  },
  define: {
    global: 'globalThis',
  },
});
