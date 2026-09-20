import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // In development the console talks to a real Honcho through whatever proxy
  // fronts it. Credentials come from .env.local, which is gitignored — nothing
  // deployment-specific belongs in this file.
  const upstream = env.HONCHO_PROXY_TARGET;
  const user = env.HONCHO_PROXY_USER;
  const pass = env.HONCHO_PROXY_PASS;

  return {
    base: env.VITE_BASE_PATH ?? "/dashboard/",
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    server: upstream
      ? {
          proxy: {
            "/dashboard-api": {
              target: upstream,
              changeOrigin: true,
              secure: true,
              headers:
                user && pass
                  ? { Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64") }
                  : undefined,
            },
          },
        }
      : undefined,
  };
});
