import { defineConfig } from "vite";

export default defineConfig({
  envPrefix: "VITE_",
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
