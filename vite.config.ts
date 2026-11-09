import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "build-revision",
      apply: "build",
      generateBundle() {
        const git = (...args: string[]) =>
          execFileSync("git", ["-C", import.meta.dirname, ...args], {
            encoding: "utf8",
            windowsHide: true,
          }).trim();
        this.emitFile({
          type: "asset",
          fileName: "build.json",
          source:
            JSON.stringify({
              commit: git("rev-parse", "HEAD"),
              dirty: git("status", "--porcelain").length > 0,
            }) + "\n",
        });
      },
    },
  ],
  build: {
    target: "es2022",
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "runtime",
              test: /\/node_modules\/(?:@supabase\/|react(?:-dom)?\/|scheduler\/)/,
            },
          ],
        },
      },
    },
  },
});
