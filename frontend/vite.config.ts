import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 11000,
    strictPort: true,
    host: "0.0.0.0",
    proxy: {
      "/api": "http://localhost:8500",
      "/ws": {
        target: "ws://localhost:8500",
        ws: true,
        configure: (proxy) => {
          proxy.on("error", () => {});
        },
      },
    },
  },
});
