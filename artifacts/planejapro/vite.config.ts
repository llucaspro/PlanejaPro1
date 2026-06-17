import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const isReplit = process.env.REPL_ID !== undefined;
const isProduction = process.env.NODE_ENV === "production";
const isVercel = process.env.VERCEL === "1";

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 3000;
const basePath = process.env.BASE_PATH ?? "/";

// On Vercel: output 2 levels up from artifacts/planejapro/ → project root /dist
// On Replit: output to artifacts/planejapro/dist/public (standard)
const outDir = isVercel
  ? path.resolve(import.meta.dirname, "../../dist")
  : path.resolve(import.meta.dirname, "dist/public");

export default defineConfig(async () => {
  const plugins = [react(), tailwindcss()];

  if (!isProduction && isReplit) {
    const [{ default: runtimeErrorOverlay }, { cartographer }, { devBanner }] = await Promise.all([
      import("@replit/vite-plugin-runtime-error-modal"),
      import("@replit/vite-plugin-cartographer"),
      import("@replit/vite-plugin-dev-banner"),
    ]);
    plugins.push(
      runtimeErrorOverlay(),
      cartographer({ root: path.resolve(import.meta.dirname, "..") }),
      devBanner(),
    );
  }

  return {
    base: basePath,
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir,
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: { strict: true },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
