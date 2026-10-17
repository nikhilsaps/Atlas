import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes all asset URLs relative, so the built site works from any
// folder on the SD card (e.g. /sites/atlas/) without a server rewrite.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
});
