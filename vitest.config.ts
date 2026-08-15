import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

function pkg(name: string) {
  return fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));
}

export default defineConfig({
  resolve: {
    // Tests run against source directly (via Vite's own TS resolution),
    // independent of each package's compiled dist/ — no prebuild required.
    alias: [
      { find: "@jarvis/shared", replacement: pkg("shared") },
      { find: "@jarvis/db", replacement: pkg("db") },
      { find: "@jarvis/security", replacement: pkg("security") },
      { find: "@jarvis/memory", replacement: pkg("memory") },
      { find: "@jarvis/ai", replacement: pkg("ai") },
      { find: "@jarvis/tools", replacement: pkg("tools") },
      { find: "@jarvis/agents", replacement: pkg("agents") },
      { find: "@jarvis/core", replacement: pkg("core") },
      { find: "@jarvis/voice", replacement: pkg("voice") },
    ],
  },
  test: {
    environment: "node",
    include: ["packages/**/src/**/*.test.ts", "apps/**/*.test.ts", "apps/**/src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    env: {
      DATABASE_URL: ":memory:",
    },
  },
});
